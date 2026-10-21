import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";

// The course requires .env to be found in the repo folder first, then one folder up.
// Next.js loads ./.env itself but never ../.env, so every server entry point calls loadEnv().

export type EnvTarget = Record<string, string | undefined>;
export type LoadEnvOptions = { cwd?: string; target?: EnvTarget };

export const KEY_NAMES = ["PORTKEY_API_KEY", "OPENAI_API_KEY"] as const;

let cached: string | null | undefined;

export function envCandidates(cwd: string = process.cwd(), p: typeof path = path): string[] {
  return [p.resolve(cwd, ".env"), p.resolve(cwd, "..", ".env")];
}

export function hasKey(env: EnvTarget = process.env): boolean {
  return KEY_NAMES.some((k) => Boolean(env[k]?.trim()));
}

/** Loads the first candidate .env that supplies a key; never overrides variables already set. Returns its path or null. */
export function loadEnv(opts: LoadEnvOptions = {}): string | null {
  const useCache = opts.cwd === undefined && opts.target === undefined;
  if (useCache && cached !== undefined) return cached;
  const target = opts.target ?? process.env;
  let found: string | null = null;
  for (const file of envCandidates(opts.cwd)) {
    if (!existsSync(file)) continue;
    config({ path: file, override: false, quiet: true, processEnv: target as Record<string, string> });
    if (hasKey(target)) {
      found = file;
      break;
    }
  }
  if (useCache) cached = found;
  return found;
}

export type ProviderName = "portkey" | "openai" | "mock";

export class NoKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoKeyError";
  }
}

export const NO_KEY_MESSAGE =
  "No API key found. Put PORTKEY_API_KEY in a .env file in the repo folder or one folder above it, or run with --provider mock.";

/** auto: Portkey, then OpenAI, then a clear error. Never falls back to the mock silently. */
export function resolveProvider(env: EnvTarget = process.env): ProviderName {
  const wanted = (env.TENET_PROVIDER?.trim() || "auto").toLowerCase();
  switch (wanted) {
    case "mock":
      return "mock";
    case "portkey":
      if (!env.PORTKEY_API_KEY?.trim()) throw new NoKeyError("TENET_PROVIDER=portkey but PORTKEY_API_KEY is not set.");
      return "portkey";
    case "openai":
      if (!env.OPENAI_API_KEY?.trim()) throw new NoKeyError("TENET_PROVIDER=openai but OPENAI_API_KEY is not set.");
      return "openai";
    case "auto":
      if (env.PORTKEY_API_KEY?.trim()) return "portkey";
      if (env.OPENAI_API_KEY?.trim()) return "openai";
      throw new NoKeyError(NO_KEY_MESSAGE);
    case "replay":
      throw new Error("The replay provider is not built yet; use --provider mock.");
    default:
      throw new Error(`Unknown TENET_PROVIDER "${wanted}". Use auto, portkey, openai or mock.`);
  }
}

export function maskKey(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  return `${"*".repeat(Math.max(4, Math.min(12, v.length - 4)))}${v.slice(-4)}`;
}
