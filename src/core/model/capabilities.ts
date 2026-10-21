import path from "node:path";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { nowIso } from "../ids";
import { Capabilities, CapabilitiesFile, capabilitiesKey } from "../schemas/capabilities";
import type { Stage, UsageEvent } from "../schemas/records";
import { dataDir, readJson, writeJsonAtomic } from "../store/fs";
import { ProviderError, type Provider, type ProviderRequest, type ProviderResponse } from "./types";

// What the gateway and model accept, decided once per provider:model (architecture §4.3). The lazy probe
// (steps 1–3, about six cheap calls) runs on the first call when data/capabilities.json has no entry; the
// full smoke test adds token accounting, rate limits and latency.

export type RawCallFn = (
  provider: Provider,
  req: ProviderRequest,
  meta: { runId: string | null; stage: Stage; kind?: UsageEvent["kind"]; attempt?: number },
) => Promise<{ response: ProviderResponse; event: UsageEvent }>;

export function capabilitiesPath(): string {
  return path.join(dataDir(), "capabilities.json");
}

export async function readCapabilitiesFile(): Promise<CapabilitiesFile> {
  return (await readJson(capabilitiesPath(), CapabilitiesFile)) ?? {};
}

export async function saveCapabilities(model: string, caps: Capabilities): Promise<void> {
  const file = await readCapabilitiesFile();
  file[capabilitiesKey(caps.provider, model)] = Capabilities.parse(caps);
  await writeJsonAtomic(capabilitiesPath(), file);
}

/** Resolves capabilities from memory, then the file, then one memoized probe per provider:model. */
export function createCapabilityResolver(raw: RawCallFn) {
  const known = new Map<string, Capabilities>();
  const inflight = new Map<string, Promise<Capabilities>>();
  return async (provider: Provider, model: string): Promise<Capabilities> => {
    if (provider.staticCapabilities) return provider.staticCapabilities;
    const key = capabilitiesKey(provider.name, model);
    const cached = known.get(key);
    if (cached) return cached;
    const stored = (await readCapabilitiesFile())[key];
    if (stored) {
      known.set(key, stored);
      return stored;
    }
    let pending = inflight.get(key);
    if (!pending) {
      pending = probeCapabilities(raw, provider, model)
        .then(async (caps) => {
          await saveCapabilities(model, caps);
          known.set(key, caps);
          return caps;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, pending);
    }
    return pending;
  };
}

const PROBE_SYSTEM = "You are a connectivity check for a testing tool. Follow the user's instruction exactly.";
const isRejected = (err: unknown) => err instanceof ProviderError && err.kind === "fatal";

function probeRequest(model: string, user: string, extra: Partial<ProviderRequest> = {}): ProviderRequest {
  return { stage: "probe", model, system: PROBE_SYSTEM, user, maxCompletionTokens: 600, timeoutMs: 90_000, ...extra };
}

/** Smoke steps 1–3: model string, structured-output mode, sampling controls. */
export async function probeCapabilities(raw: RawCallFn, provider: Provider, model: string): Promise<Capabilities> {
  const meta = { runId: null, stage: "probe" as const };

  let modelString: string | null = null;
  let reasoningTokensReported: boolean | null = null;
  let lastError: unknown = null;
  for (const candidate of [model, `@openai/${model}`]) {
    try {
      const { response } = await raw(provider, probeRequest(candidate, "Reply with the single word OK."), meta);
      modelString = candidate;
      reasoningTokensReported = response.usage ? response.usage.reasoning !== null : null;
      break;
    } catch (err) {
      lastError = err;
      if (!isRejected(err)) throw err;
    }
  }
  if (!modelString) {
    throw new Error(`No model string worked for ${provider.name} (${model}): ${(lastError as Error)?.message ?? "unknown error"}`);
  }

  const probeSchema = z.object({ ok: z.boolean(), word: z.string() });
  let responseMode: Capabilities["responseMode"] = "prompt";
  try {
    await raw(
      provider,
      probeRequest(modelString, 'Return ok=true and word="tenet".', { responseFormat: zodResponseFormat(probeSchema, "probe") }),
      meta,
    );
    responseMode = "strict";
  } catch (err) {
    if (!isRejected(err)) throw err;
    try {
      await raw(
        provider,
        probeRequest(modelString, 'Return the JSON object {"ok": true, "word": "tenet"}.', { responseFormat: { type: "json_object" } }),
        meta,
      );
      responseMode = "json_object";
    } catch (err2) {
      if (!isRejected(err2)) throw err2;
    }
  }

  let temperature = false;
  try {
    await raw(provider, probeRequest(modelString, "Reply with the single word OK.", { temperature: 0 }), meta);
    temperature = true;
  } catch (err) {
    if (!isRejected(err)) throw err;
  }

  const efforts: string[] = [];
  for (const effort of ["low", "minimal"]) {
    try {
      await raw(provider, probeRequest(modelString, "Reply with the single word OK.", { reasoningEffort: effort }), meta);
      efforts.push(effort);
    } catch (err) {
      if (!isRejected(err)) throw err;
    }
  }

  return {
    provider: provider.name as Capabilities["provider"],
    modelString,
    headers: {},
    responseMode,
    temperature,
    reasoningEffort: efforts.length ? efforts : false,
    promptCacheKey: false,
    cachedTokensReported: null,
    cachedOnRepeat: null,
    reasoningTokensReported,
    suggestedConcurrency: null,
    medianLatencyMs: null,
    probedAt: nowIso(),
    source: "lazy",
  };
}
