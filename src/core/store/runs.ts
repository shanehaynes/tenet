import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ZodType } from "zod";
import { z } from "zod";
import { newId, nowIso } from "../ids";
import {
  Collision,
  Rule,
  Run,
  RunEvent,
  Scenario,
  TestDesign,
  Transcript,
  Verdict,
  type RunConfig,
  type Totals,
} from "../schemas/records";
import { appendJsonl, dataDir, readJson, readJsonl, writeJsonAtomic } from "./fs";

// Per-run storage (architecture §5). Every mutation goes through withRun(), one promise chain per run, so
// concurrent execute→judge chains can never read-modify-write the same file and lose an update.

export type RunFiles = {
  run: Run;
  rules: Rule[];
  collisions: Collision[];
  scenarios: Scenario[];
  designs: TestDesign[];
  verdicts: Verdict[];
};
type FileKey = keyof RunFiles;

const FILES: { [K in FileKey]: { name: string; schema: ZodType<RunFiles[K]>; empty: RunFiles[K] | null } } = {
  run: { name: "run.json", schema: Run, empty: null },
  rules: { name: "rules.json", schema: z.array(Rule), empty: [] },
  collisions: { name: "collisions.json", schema: z.array(Collision), empty: [] },
  scenarios: { name: "scenarios.json", schema: z.array(Scenario), empty: [] },
  designs: { name: "designs.json", schema: z.array(TestDesign), empty: [] },
  verdicts: { name: "verdicts.json", schema: z.array(Verdict), empty: [] },
};

export class RunNotFound extends Error {
  constructor(runId: string) {
    super(`Run ${runId} not found`);
    this.name = "RunNotFound";
  }
}

export function runsDir(): string {
  return path.join(dataDir(), "runs");
}

/** Run and scenario ids are path segments, so only these characters are accepted. */
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function runDir(runId: string): string {
  if (!SAFE_ID.test(runId)) throw new RunNotFound(runId);
  return path.join(runsDir(), runId);
}

export function runFilePath(runId: string, name: string): string {
  return path.join(runDir(runId), name);
}

export async function readRunFile<K extends FileKey>(runId: string, key: K): Promise<RunFiles[K]> {
  const spec = FILES[key];
  const value = await readJson(runFilePath(runId, spec.name), spec.schema);
  if (value !== null) return value;
  if (spec.empty === null) throw new RunNotFound(runId);
  return structuredClone(spec.empty);
}

export async function readRun(runId: string): Promise<Run> {
  return readRunFile(runId, "run");
}

export async function runExists(runId: string): Promise<boolean> {
  try {
    await readRun(runId);
    return true;
  } catch (err) {
    if (err instanceof RunNotFound) return false;
    throw err;
  }
}

export type RunTx = {
  get<K extends FileKey>(key: K): Promise<RunFiles[K]>;
  set<K extends FileKey>(key: K, value: RunFiles[K]): void;
};

const globalQueues = globalThis as unknown as { __tenetRunQueues?: Map<string, Promise<unknown>> };
const queues = (globalQueues.__tenetRunQueues ??= new Map());

/**
 * Runs `mutate` alone for this run: reads are cached within the transaction, and files passed to `set` are
 * written atomically after `mutate` resolves. If `mutate` throws, nothing is written.
 */
export function withRun<R>(runId: string, mutate: (tx: RunTx) => R | Promise<R>): Promise<R> {
  const prev = queues.get(runId) ?? Promise.resolve();
  const next = prev.then(async () => {
    const cache = new Map<FileKey, unknown>();
    const dirty = new Set<FileKey>();
    const tx: RunTx = {
      async get(key) {
        if (!cache.has(key)) cache.set(key, await readRunFile(runId, key));
        return cache.get(key) as RunFiles[typeof key];
      },
      set(key, value) {
        cache.set(key, value);
        dirty.add(key);
      },
    };
    const result = await mutate(tx);
    if (dirty.has("run")) (cache.get("run") as Run).updatedAt = nowIso();
    for (const key of dirty) await writeJsonAtomic(runFilePath(runId, FILES[key].name), cache.get(key));
    return result;
  });
  const tail = next.catch(() => undefined);
  queues.set(runId, tail);
  void tail.then(() => {
    if (queues.get(runId) === tail) queues.delete(runId);
  });
  return next;
}

export function emptyTotals(): Totals {
  return {
    calls: 0,
    inputTokens: 0,
    cachedTokens: null,
    reasoningTokens: null,
    outputTokens: 0,
    usd: 0,
    analysisUsd: 0,
    testUsd: 0,
  };
}

export async function createRun(input: { policyId: string; policyName: string; config: RunConfig }): Promise<Run> {
  const now = nowIso();
  const run: Run = {
    id: newId(),
    policyId: input.policyId,
    policyName: input.policyName,
    createdAt: now,
    updatedAt: now,
    status: "created",
    statusReason: null,
    config: input.config,
    heartbeatAt: null,
    startedExecutionAt: null,
    finishedAt: null,
    wallClockMs: null,
    totals: emptyTotals(),
    nextRuleNumber: 1,
    untestablePassages: [],
    warnings: [],
  };
  await writeJsonAtomic(runFilePath(run.id, FILES.run.name), Run.parse(run));
  return run;
}

export async function listRuns(): Promise<Run[]> {
  let entries: string[];
  try {
    entries = await readdir(runsDir());
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const runs: Run[] = [];
  for (const id of entries) {
    if (!SAFE_ID.test(id)) continue; // e.g. a .DS_Store left by Finder
    const run = await readJson(runFilePath(id, FILES.run.name), Run).catch(() => null);
    if (run) runs.push(run);
  }
  return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function appendEvent(
  runId: string,
  event: Omit<RunEvent, "ts" | "level"> & { level?: RunEvent["level"] },
): Promise<void> {
  const line: RunEvent = { ts: nowIso(), level: event.level ?? "info", stage: event.stage, message: event.message };
  if (event.data !== undefined) line.data = event.data;
  await appendJsonl(runFilePath(runId, "events.jsonl"), line);
}

export async function readEvents(runId: string, limit?: number): Promise<RunEvent[]> {
  const events = await readJsonl(runFilePath(runId, "events.jsonl"), RunEvent);
  return limit ? events.slice(-limit) : events;
}

export async function writeTranscript(runId: string, transcript: Transcript): Promise<void> {
  await writeJsonAtomic(runFilePath(runId, path.join("transcripts", `${transcript.scenarioId}.json`)), transcript);
}

export async function readTranscript(runId: string, scenarioId: string): Promise<Transcript | null> {
  if (!SAFE_ID.test(scenarioId)) return null;
  return readJson(runFilePath(runId, path.join("transcripts", `${scenarioId}.json`)), Transcript);
}
