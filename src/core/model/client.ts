import { createHash } from "node:crypto";
import { zodResponseFormat } from "openai/helpers/zod";
import { z, type ZodType } from "zod";
import { settings } from "../config";
import { loadEnv, resolveProvider, type ProviderName } from "../env";
import { nowIso } from "../ids";
import { Ledger } from "../pipeline/budget";
import {
  MAX_LENGTH_RETRIES,
  MAX_OUTPUT_TOKENS,
  MAX_RATE_LIMIT_WAITS,
  MAX_REPAIRS,
  MAX_TRANSIENT_RETRIES,
} from "../pipeline/guards";
import type { Capabilities } from "../schemas/capabilities";
import type { Stage, UsageEvent } from "../schemas/records";
import { appendUsage, keySpend } from "../store/usage";
import { createCapabilityResolver } from "./capabilities";
import { usd, type Prices } from "./pricing";
import { providerByName } from "./providers";
import {
  ModelCallFailed,
  ProviderError,
  SchemaInvalid,
  type Provider,
  type ProviderRequest,
  type ProviderResponse,
} from "./types";

// callModel: the one wrapper every model call goes through (architecture §4.4, amended 2026-10-21).
// Order: ledger check → capability-gated request → retries (transient once, 429 up to three waits, length once
// at twice the cap) → parse and validate → one repair → SchemaInvalid. Every attempt is logged.

export type MockInput = {
  system: string;
  user: string;
  stage: Stage;
  ruleId: string | null;
  scenarioId: string | null;
  schemaName?: string;
};

export type CallArgs<T> = {
  runId: string | null;
  stage: Stage;
  ruleId?: string | null;
  scenarioId?: string | null;
  /** Static text first (cached across calls), variable text last. */
  system: string;
  user: string;
  schema?: ZodType<T>;
  schemaName?: string;
  /** Output cap; includes reasoning tokens. */
  maxOutputTokens: number;
  /** "target" is the model under test (free text, truncation tolerated); everything else is "agent". */
  role?: "agent" | "target";
  model?: string;
  reasoningEffort?: string;
  signal?: AbortSignal;
  /** Deterministic output used when the provider is the mock. Lives next to the agent's prompt. */
  mock?: (input: MockInput) => T | string;
};

export type CallResult<T> = {
  data: T;
  text: string;
  finishReason: string | null;
  truncated: boolean;
  attempts: number;
  usd: number;
  ms: number;
  model: string;
  provider: string;
  events: UsageEvent[];
};

export type RawMeta = {
  runId: string | null;
  stage: Stage;
  ruleId?: string | null;
  scenarioId?: string | null;
  role?: "agent" | "target";
  kind?: UsageEvent["kind"];
  attempt?: number;
  responseMode?: UsageEvent["responseMode"];
};

export type ModelDeps = {
  providerFor(stage: Stage): Provider;
  modelFor(stage: Stage, override?: string): string;
  capabilities(provider: Provider, model: string): Promise<Capabilities>;
  ledger: Ledger;
  usageSink(event: UsageEvent): Promise<void>;
  prices(): Prices;
  sleep(ms: number): Promise<void>;
  now(): number;
};

export type ModelClient = {
  callModel<T = string>(args: CallArgs<T>): Promise<CallResult<T>>;
  /** One logged provider call with no retries or parsing; the capability probe and smoke test use it. */
  rawCall(provider: Provider, req: ProviderRequest, meta: RawMeta): Promise<{ response: ProviderResponse; event: UsageEvent }>;
};

export function schemaInstruction(schema: ZodType): string {
  return `Return only a JSON object that matches this JSON schema, with no prose and no code fences:\n${JSON.stringify(
    z.toJSONSchema(schema),
  )}`;
}

/** Pulls the outermost JSON object out of a reply (tolerates code fences and stray prose). */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body.trim();
}

function validationError(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)
    .join("; ");
}

function parseStructured<T>(text: string, schema: ZodType<T>): { ok: true; data: T } | { ok: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(extractJson(text));
  } catch (err) {
    return { ok: false, error: `not valid JSON (${(err as Error).message})` };
  }
  const parsed = schema.safeParse(value);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: validationError(parsed.error) };
}

export function createModelClient(deps: ModelDeps): ModelClient {
  function makeEvent(
    provider: Provider,
    model: string,
    meta: RawMeta,
    outcome: { ok: boolean; response?: ProviderResponse; error?: string; ms: number },
  ): UsageEvent {
    const u = outcome.response?.usage ?? null;
    const tokens = { inputTokens: u?.input ?? 0, cachedTokens: u ? u.cached : null, outputTokens: u?.output ?? 0 };
    return {
      ts: nowIso(),
      runId: meta.runId,
      ruleId: meta.ruleId ?? null,
      scenarioId: meta.scenarioId ?? null,
      stage: meta.stage,
      provider: provider.name,
      model: outcome.response?.model ?? model,
      role: meta.role ?? "agent",
      kind: meta.kind ?? "call",
      attempt: meta.attempt ?? 1,
      ok: outcome.ok,
      inputTokens: tokens.inputTokens,
      cachedTokens: tokens.cachedTokens,
      reasoningTokens: u ? u.reasoning : null,
      outputTokens: tokens.outputTokens,
      ms: outcome.ms,
      usd: u ? usd(tokens, deps.prices()) : 0,
      finishReason: outcome.response?.finishReason ?? null,
      error: outcome.error ?? null,
      responseMode: meta.responseMode ?? "text",
      usageEstimated: u?.estimated ?? false,
      reportedByTarget: false,
      gatewayCache: outcome.response?.gatewayCache ?? null,
    };
  }

  async function log(event: UsageEvent): Promise<void> {
    deps.ledger.record(event);
    await deps.usageSink(event);
  }

  async function rawCall(provider: Provider, req: ProviderRequest, meta: RawMeta) {
    await deps.ledger.assertCanCall(meta.runId, meta.stage, provider.billed);
    const started = deps.now();
    try {
      const response = await provider.complete(req);
      const event = makeEvent(provider, req.model, meta, { ok: true, response, ms: deps.now() - started });
      await log(event);
      return { response, event };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await log(makeEvent(provider, req.model, meta, { ok: false, error: message, ms: deps.now() - started }));
      throw err; // providers throw ProviderError for API failures; anything else (NoMockHandler) propagates as-is
    }
  }

  async function callModel<T = string>(args: CallArgs<T>): Promise<CallResult<T>> {
    const provider = deps.providerFor(args.stage);
    const model = deps.modelFor(args.stage, args.model);
    const caps = await deps.capabilities(provider, model);
    const role = args.role ?? "agent";
    const responseMode: UsageEvent["responseMode"] = args.schema ? caps.responseMode : "text";

    let system = args.system;
    let responseFormat: ProviderRequest["responseFormat"];
    if (args.schema) {
      if (responseMode === "strict") responseFormat = zodResponseFormat(args.schema, args.schemaName ?? "output");
      else {
        system = `${system}\n\n${schemaInstruction(args.schema)}`;
        if (responseMode === "json_object") responseFormat = { type: "json_object" };
      }
    }
    const effort = args.reasoningEffort ?? "low";
    const base: Omit<ProviderRequest, "user" | "maxCompletionTokens"> = {
      stage: args.stage,
      model: caps.modelString === "mock" ? model : caps.modelString,
      system,
      timeoutMs: 90_000,
      signal: args.signal,
      schemaName: args.schemaName,
      headers: Object.keys(caps.headers).length ? caps.headers : undefined,
      responseFormat,
    };
    if (caps.temperature) base.temperature = 0;
    if (Array.isArray(caps.reasoningEffort) && caps.reasoningEffort.includes(effort)) base.reasoningEffort = effort;
    if (caps.promptCacheKey) {
      base.promptCacheKey = `tenet-${args.stage}-${createHash("sha256").update(system).digest("hex").slice(0, 16)}`;
    }
    const mockInput: MockInput = {
      system: args.system,
      user: args.user,
      stage: args.stage,
      ruleId: args.ruleId ?? null,
      scenarioId: args.scenarioId ?? null,
      schemaName: args.schemaName,
    };
    const mock = args.mock ? () => args.mock!(mockInput) : undefined;

    const events: UsageEvent[] = [];
    let user = args.user;
    let maxTokens = args.maxOutputTokens;
    let kind: UsageEvent["kind"] = "call";
    let attempt = 0;
    let transient = 0;
    let waits = 0;
    let lengthRetries = 0;
    let repairs = 0;
    const started = deps.now();

    for (;;) {
      attempt += 1;
      const meta: RawMeta = {
        runId: args.runId,
        stage: args.stage,
        ruleId: args.ruleId,
        scenarioId: args.scenarioId,
        role,
        kind,
        attempt,
        responseMode,
      };
      let response: ProviderResponse;
      try {
        const out = await rawCall(provider, { ...base, user, maxCompletionTokens: maxTokens, mock }, meta);
        response = out.response;
        events.push(out.event);
      } catch (err) {
        if (!(err instanceof ProviderError)) throw err; // budget, guard, key budget, no mock handler
        if (err.kind === "rate_limit" && waits < MAX_RATE_LIMIT_WAITS) {
          waits += 1;
          await deps.sleep(err.retryAfterMs ?? 2000 * 2 ** (waits - 1));
          kind = "retry";
          continue;
        }
        if (err.kind === "transient" && transient < MAX_TRANSIENT_RETRIES) {
          transient += 1;
          await deps.sleep(1000);
          kind = "retry";
          continue;
        }
        throw new ModelCallFailed(args.stage, err);
      }

      const result = (data: T, truncated: boolean): CallResult<T> => ({
        data,
        text: response.text,
        finishReason: response.finishReason,
        truncated,
        attempts: attempt,
        usd: events.reduce((s, e) => s + e.usd, 0),
        ms: deps.now() - started,
        model: response.model,
        provider: provider.name,
        events,
      });

      if (response.finishReason === "length") {
        if (lengthRetries < MAX_LENGTH_RETRIES) {
          lengthRetries += 1;
          maxTokens = Math.min(maxTokens * 2, MAX_OUTPUT_TOKENS);
          kind = "length_retry";
          continue;
        }
        if (!args.schema) return result(response.text as T, true);
        throw new SchemaInvalid(args.stage, `${args.stage} output was cut off by the token limit twice`, response.text);
      }

      if (!args.schema) return result(response.text as T, false);

      const parsed = response.refusal
        ? ({ ok: false, error: `the model refused: ${response.refusal}` } as const)
        : parseStructured(response.text, args.schema);
      if (parsed.ok) return result(parsed.data, false);
      if (repairs < MAX_REPAIRS) {
        repairs += 1;
        kind = "repair";
        user =
          `${args.user}\n\nYour previous output failed validation: ${parsed.error}\n` +
          `Previous output:\n${response.text.slice(0, 4000)}\n\nReturn only the corrected JSON object.`;
        continue;
      }
      throw new SchemaInvalid(args.stage, `${args.stage} output failed validation: ${parsed.error}`, response.text);
    }
  }

  return { callModel, rawCall };
}

// The process-wide client, built lazily from env. Lives on globalThis so Next's HMR does not create a second
// ledger mid-run.

type Globals = { __tenetModel?: { client: ModelClient; ledger: Ledger } };
const g = globalThis as unknown as Globals;

export function defaultLedger(): Ledger {
  return modelRuntime().ledger;
}

function modelRuntime(): { client: ModelClient; ledger: Ledger } {
  if (g.__tenetModel) return g.__tenetModel;
  loadEnv();
  const ledger = new Ledger({
    keySpend,
    keyBudgetUsd: () => settings().keyBudgetUsd,
    allowOverKeyBudget: () => settings().allowOverKeyBudget,
    warn: (message) => console.warn(`[tenet] ${message}`),
  });
  const runtime: { client: ModelClient; ledger: Ledger } = { client: undefined as unknown as ModelClient, ledger };
  const resolver = createCapabilityResolver((provider, req, meta) => runtime.client.rawCall(provider, req, meta));
  runtime.client = createModelClient({
    providerFor(stage) {
      const judgeProvider = process.env.TENET_JUDGE_PROVIDER?.trim();
      const name: ProviderName =
        stage === "judge" && judgeProvider
          ? resolveProvider({ ...process.env, TENET_PROVIDER: judgeProvider })
          : resolveProvider(process.env);
      return providerByName(name);
    },
    modelFor(stage, override) {
      if (override) return override;
      const s = settings();
      return stage === "judge" ? s.judgeModel : s.targetModel;
    },
    capabilities: resolver,
    ledger,
    usageSink: appendUsage,
    prices: () => settings().prices,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
  });
  g.__tenetModel = runtime;
  return runtime;
}

export function modelClient(): ModelClient {
  return modelRuntime().client;
}

export function callModel<T = string>(args: CallArgs<T>): Promise<CallResult<T>> {
  return modelClient().callModel(args);
}

/** Drops the process-wide client (tests, or the CLI after changing --provider). */
export function resetModelClient(): void {
  delete g.__tenetModel;
}
