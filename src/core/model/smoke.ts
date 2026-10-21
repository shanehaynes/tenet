import { readFileSync } from "node:fs";
import path from "node:path";
import { buildExecutorSystemPrompt } from "../agents/executorPrompt";
import type { Capabilities } from "../schemas/capabilities";
import type { UsageEvent } from "../schemas/records";
import { probeCapabilities, type RawCallFn } from "./capabilities";
import { ProviderError, type Provider, type ProviderRequest } from "./types";

// The full smoke test (architecture §4.3, steps 1–6). Steps 1–3 are the lazy probe; this adds token
// accounting (does the gateway report cached and reasoning tokens, and does a repeated 1,100+ token prefix
// actually get cached), rate limits and latency. Every call is logged with stage "probe".

export type SmokeStep = { step: string; result: string; detail: string };
export type SmokeReport = { caps: Capabilities; steps: SmokeStep[]; calls: number; usd: number };

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export async function runSmoke(raw: RawCallFn, provider: Provider, model: string, samplesDir: string): Promise<SmokeReport> {
  const events: UsageEvent[] = [];
  const logged: RawCallFn = async (p, req, meta) => {
    try {
      const out = await raw(p, req, meta);
      events.push(out.event);
      return out;
    } catch (err) {
      events.push({ ok: false, ms: 0, usd: 0 } as UsageEvent);
      throw err;
    }
  };
  const steps: SmokeStep[] = [];

  const caps = await probeCapabilities(logged, provider, model);
  steps.push({ step: "1 auth and model string", result: "ok", detail: `${provider.name} accepts "${caps.modelString}"` });
  steps.push({ step: "2 structured outputs", result: caps.responseMode, detail: caps.responseMode === "strict" ? "strict json_schema accepted" : "strict json_schema rejected; fallback in use" });
  steps.push({
    step: "3 sampling controls",
    result: `temperature ${caps.temperature ? "accepted" : "rejected"}`,
    detail: `reasoning_effort accepted: ${caps.reasoningEffort === false ? "none" : caps.reasoningEffort.join(", ")}`,
  });

  // 4. Token accounting on the real executor prefix (Harrow & Vale), sent twice.
  const policy = readFileSync(path.join(samplesDir, "harrow-vale.md"), "utf8");
  const system = buildExecutorSystemPrompt(policy);
  const req = (extra: Partial<ProviderRequest> = {}): ProviderRequest => ({
    stage: "probe",
    model: caps.modelString,
    system,
    user: "Reply with the single word OK.",
    maxCompletionTokens: 400,
    timeoutMs: 90_000,
    ...(caps.reasoningEffort && caps.reasoningEffort.includes("low") ? { reasoningEffort: "low" } : {}),
    ...extra,
  });
  const meta = { runId: null, stage: "probe" as const };
  const first = await logged(provider, req(), meta);
  const second = await logged(provider, req(), meta);
  const cachedReported = second.response.usage ? second.response.usage.cached !== null : false;
  const cachedOnRepeat = (second.response.usage?.cached ?? 0) > 0;
  caps.cachedTokensReported = cachedReported;
  caps.cachedOnRepeat = cachedOnRepeat;
  caps.reasoningTokensReported = second.response.usage ? second.response.usage.reasoning !== null : null;
  steps.push({
    step: "4 token accounting",
    result: cachedOnRepeat ? "cached on repeat" : cachedReported ? "reported, 0 cached" : "cached tokens not reported",
    detail: `prefix ${first.response.usage?.input ?? "?"} input tokens; repeat cached ${second.response.usage?.cached ?? "null"}; reasoning tokens ${second.response.usage?.reasoning ?? "null"}`,
  });
  try {
    await logged(provider, req({ promptCacheKey: "tenet-smoke-executor" }), meta);
    caps.promptCacheKey = true;
  } catch (err) {
    if (!(err instanceof ProviderError && err.kind === "fatal")) throw err;
    caps.promptCacheKey = false;
  }
  steps.push({ step: "4b prompt_cache_key", result: caps.promptCacheKey ? "accepted" : "rejected", detail: "" });

  // 5. Rate limits: eight parallel calls.
  const burst = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      logged(provider, { stage: "probe", model: caps.modelString, system: "Connectivity check.", user: "Reply with OK.", maxCompletionTokens: 200, timeoutMs: 90_000 }, meta),
    ),
  );
  const limited = burst.filter((r) => r.status === "rejected" && r.reason instanceof ProviderError && r.reason.kind === "rate_limit").length;
  const failed = burst.filter((r) => r.status === "rejected").length;
  caps.suggestedConcurrency = limited === 0 && failed === 0 ? 8 : limited <= 2 ? 4 : 2;
  steps.push({ step: "5 rate limits", result: `${limited} of 8 rate-limited`, detail: `suggested concurrency ${caps.suggestedConcurrency}` });

  // 6. Latency
  caps.medianLatencyMs = median(events.filter((e) => e.ok).map((e) => e.ms));
  steps.push({ step: "6 latency", result: `median ${caps.medianLatencyMs ?? "?"} ms`, detail: `${events.length} calls` });

  caps.source = "smoke";
  return { caps, steps, calls: events.length, usd: events.reduce((s, e) => s + (e.usd ?? 0), 0) };
}
