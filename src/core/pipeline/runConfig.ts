import { settings } from "../config";
import { resolveProvider, type EnvTarget } from "../env";
import type { RunConfig, Target } from "../schemas/records";
import { HTTP_TIMEOUT_MS } from "./guards";

/** A run's config from env defaults (architecture §3.2), with per-run overrides from the UI or CLI. */
export function defaultRunConfig(overrides: Partial<RunConfig> = {}, env: EnvTarget = process.env): RunConfig {
  const s = settings(env);
  const provider = overrides.provider ?? resolveProvider(env);
  return {
    provider,
    target: { kind: "model", provider, model: s.targetModel },
    targetModel: s.targetModel,
    judgeModel: s.judgeModel,
    spendCapUsd: s.spendCapUsd,
    concurrency: s.concurrency,
    ambiguityThreshold: s.ambiguityThreshold,
    flatComparison: false,
    rungs: 6,
    disabledGenerators: [],
    ...overrides,
  };
}

/** An HTTP agent target (architecture §4.6) from a URL, else TENET_AGENT_URL; null when neither is set. */
export function httpTarget(opts: { url?: string | null; agent?: string | null; name?: string | null } = {}, env: EnvTarget = process.env): Extract<Target, { kind: "http" }> | null {
  const s = settings(env);
  const url = opts.url?.trim() || s.agentUrl;
  if (!url) return null;
  const agent = opts.agent?.trim() || null;
  let name = opts.name?.trim() || s.agentName;
  if (!name) {
    try {
      name = new URL(url).host;
    } catch {
      name = url;
    }
  }
  return { kind: "http", name, url, agent, headers: {}, timeoutMs: HTTP_TIMEOUT_MS, resetPerScenario: true };
}
