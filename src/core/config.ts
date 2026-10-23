import path from "node:path";
import type { EnvTarget } from "./env";

// Typed settings with the defaults from architecture §3.2. Read at call time so tests and the CLI can change env.

function num(env: EnvTarget, name: string, fallback: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number, got "${raw}"`);
  return n;
}

export type Settings = {
  targetModel: string;
  judgeModel: string;
  spendCapUsd: number;
  concurrency: number;
  ambiguityThreshold: number;
  prices: { inputPerM: number; cachedPerM: number; outputPerM: number };
  keyBudgetUsd: number;
  allowOverKeyBudget: boolean;
  dataDir: string;
  agentUrl: string | null;
  agentName: string | null;
};

export function settings(env: EnvTarget = process.env): Settings {
  const targetModel = env.TENET_TARGET_MODEL?.trim() || "gpt-6-luna";
  return {
    targetModel,
    judgeModel: env.TENET_JUDGE_MODEL?.trim() || targetModel,
    spendCapUsd: num(env, "TENET_SPEND_CAP_USD", 2),
    concurrency: Math.max(1, Math.floor(num(env, "TENET_CONCURRENCY", 4))),
    ambiguityThreshold: num(env, "TENET_AMBIGUITY_THRESHOLD", 0.7),
    prices: {
      inputPerM: num(env, "TENET_PRICE_INPUT_PER_M", 0.1),
      cachedPerM: num(env, "TENET_PRICE_CACHED_PER_M", 0.01),
      outputPerM: num(env, "TENET_PRICE_OUTPUT_PER_M", 0.5),
    },
    keyBudgetUsd: num(env, "TENET_KEY_BUDGET_USD", 40),
    allowOverKeyBudget: env.TENET_ALLOW_OVER_KEY_BUDGET === "1",
    dataDir: path.resolve(/*turbopackIgnore: true*/ env.TENET_DATA_DIR?.trim() || path.join(process.cwd(), "data")),
    agentUrl: env.TENET_AGENT_URL?.trim() || null,
    agentName: env.TENET_AGENT_NAME?.trim() || null,
  };
}
