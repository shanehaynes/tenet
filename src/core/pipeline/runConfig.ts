import { settings } from "../config";
import { resolveProvider, type EnvTarget } from "../env";
import type { RunConfig } from "../schemas/records";

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
