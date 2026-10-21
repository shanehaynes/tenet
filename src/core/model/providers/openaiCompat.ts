import OpenAI, { APIConnectionError, APIError, APIUserAbortError } from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import type { ReasoningEffort } from "openai/resources/shared";
import { ProviderError, type Provider, type ProviderRequest, type ProviderResponse } from "../types";

// Portkey and OpenAI both speak Chat Completions; only the base URL and auth differ (architecture §4.2).

export const PORTKEY_BASE_URL = "https://api.portkey.ai/v1";

function retryAfterMs(headers: Headers | undefined): number | undefined {
  if (!headers) return undefined;
  const ms = Number(headers.get("retry-after-ms"));
  if (Number.isFinite(ms) && ms > 0) return ms;
  const raw = headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

export function toProviderError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  if (err instanceof APIUserAbortError) return new ProviderError("aborted", "Request aborted");
  if (err instanceof APIConnectionError) return new ProviderError("transient", err.message || "Connection error");
  if (err instanceof APIError) {
    const status = err.status;
    const message = err.message || `HTTP ${status}`;
    if (status === 429) return new ProviderError("rate_limit", message, status, retryAfterMs(err.headers));
    if (status !== undefined && (status >= 500 || status === 408 || status === 409)) {
      return new ProviderError("transient", message, status);
    }
    return new ProviderError("fatal", message, status);
  }
  if ((err as Error)?.name === "AbortError") return new ProviderError("aborted", "Request aborted");
  return new ProviderError("fatal", err instanceof Error ? err.message : String(err));
}

export function createOpenAICompatProvider(
  name: "portkey" | "openai",
  opts: { apiKey: string; baseURL?: string; defaultHeaders?: Record<string, string> },
): Provider {
  const client = new OpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL,
    defaultHeaders: opts.defaultHeaders,
    maxRetries: 0, // callModel retries itself so every attempt is logged
    timeout: 90_000,
  });

  return {
    name,
    billed: true,
    async complete(req: ProviderRequest): Promise<ProviderResponse> {
      const body: ChatCompletionCreateParamsNonStreaming = {
        model: req.model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        max_completion_tokens: req.maxCompletionTokens,
      };
      if (req.temperature !== undefined) body.temperature = req.temperature;
      if (req.reasoningEffort) body.reasoning_effort = req.reasoningEffort as ReasoningEffort;
      if (req.responseFormat) body.response_format = req.responseFormat;
      if (req.promptCacheKey) body.prompt_cache_key = req.promptCacheKey;
      // Portkey replays identical requests from a response cache (docs/evidence/tokenomics/gateway-cache.md), which
      // would make a re-run repeat an earlier run instead of measuring anything. Every call asks for a fresh answer
      // unless TENET_GATEWAY_CACHE=allow.
      const headers = name === "portkey" && process.env.TENET_GATEWAY_CACHE?.trim() !== "allow" ? { "x-portkey-cache-force-refresh": "true", ...req.headers } : req.headers;
      try {
        const { data: res, response } = await client.chat.completions
          .create(body, {
            timeout: req.timeoutMs,
            signal: req.signal,
            headers,
          })
          .withResponse();
        const choice = res.choices[0];
        const usage = res.usage;
        return {
          text: choice?.message?.content ?? "",
          refusal: choice?.message?.refusal ?? null,
          finishReason: choice?.finish_reason ?? null,
          model: res.model ?? req.model,
          gatewayCache: response.headers.get("x-portkey-cache-status")?.toLowerCase() ?? null,
          usage: usage
            ? {
                input: usage.prompt_tokens ?? 0,
                cached: usage.prompt_tokens_details?.cached_tokens ?? null,
                reasoning: usage.completion_tokens_details?.reasoning_tokens ?? null,
                output: usage.completion_tokens ?? 0,
                estimated: false,
              }
            : null,
        };
      } catch (err) {
        throw toProviderError(err);
      }
    },
  };
}
