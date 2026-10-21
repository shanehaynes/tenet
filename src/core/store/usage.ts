import { stat } from "node:fs/promises";
import path from "node:path";
import { UsageEvent } from "../schemas/records";
import { appendJsonl, dataDir, readJsonl } from "./fs";
import { runFilePath } from "./runs";

// Every model call is logged twice: to its run's usage.jsonl (per-run tokenomics) and to the global log,
// which is the cumulative spend on the course key ($40 budget; evidence M21).

export function globalUsagePath(): string {
  return path.join(dataDir(), "usage-global.jsonl");
}

export async function appendUsage(event: UsageEvent): Promise<void> {
  const line = UsageEvent.parse(event);
  if (line.runId) await appendJsonl(runFilePath(line.runId, "usage.jsonl"), line);
  await appendJsonl(globalUsagePath(), line);
}

export async function readRunUsage(runId: string): Promise<UsageEvent[]> {
  return readJsonl(runFilePath(runId, "usage.jsonl"), UsageEvent);
}

export async function readGlobalUsage(): Promise<UsageEvent[]> {
  return readJsonl(globalUsagePath(), UsageEvent);
}

/** Providers whose calls are billed to a real key. Mock calls are logged but cost nothing. */
const BILLED = new Set(["portkey", "openai"]);

export type KeySpend = { usd: number; calls: number; byProvider: Record<string, number> };

let cache: { file: string; size: number; mtimeMs: number; spend: KeySpend } | null = null;

/** Cumulative billed spend from the global log; re-reads only when the file has changed. */
export async function keySpend(): Promise<KeySpend> {
  const file = globalUsagePath();
  let info: { size: number; mtimeMs: number };
  try {
    info = await stat(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { usd: 0, calls: 0, byProvider: {} };
    throw err;
  }
  if (cache && cache.file === file && cache.size === info.size && cache.mtimeMs === info.mtimeMs) return cache.spend;
  const spend: KeySpend = { usd: 0, calls: 0, byProvider: {} };
  for (const e of await readGlobalUsage()) {
    // An HTTP target (the HW5 agents) runs on the same course key, so the usage it reports counts too.
    if (!BILLED.has(e.provider) && !e.reportedByTarget) continue;
    spend.usd += e.usd;
    spend.calls += 1;
    spend.byProvider[e.provider] = (spend.byProvider[e.provider] ?? 0) + e.usd;
  }
  cache = { file, size: info.size, mtimeMs: info.mtimeMs, spend };
  return spend;
}
