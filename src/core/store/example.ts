import { readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { Scenario, Transcript, Verdict } from "../schemas/records";
import { Summary } from "../schemas/summary";
import { readJson } from "./fs";

// The archived example run (evidence-report-slides.md §6): a real run committed under docs/evidence/runs/,
// rendered at /runs/example without a key or a model call, so the app still shows what it does if a
// grader's key fails.

export type ScenarioDetail = { scenario: Scenario; transcript: Transcript | null; verdict: Verdict | null };
export type ExampleRun = { runId: string; note: string; summary: Summary; details: Record<string, ScenarioDetail> };

function exampleRoot(): string {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "docs", "evidence", "runs");
}

export async function readExampleRun(): Promise<ExampleRun | null> {
  const root = exampleRoot();
  const pointer = await readJson(path.join(root, "example.json"), z.object({ runId: z.string(), note: z.string() })).catch(() => null);
  if (!pointer || !/^[A-Za-z0-9_-]+$/.test(pointer.runId)) return null;
  const dir = path.join(root, pointer.runId);
  const summary = await readJson(path.join(dir, "summary.json"), Summary).catch(() => null);
  if (!summary) return null;
  const scenarios = (await readJson(path.join(dir, "scenarios.json"), z.array(Scenario))) ?? [];
  const verdicts = new Map(((await readJson(path.join(dir, "verdicts.json"), z.array(Verdict))) ?? []).map((v) => [v.scenarioId, v]));
  const files = new Set(await readdir(path.join(dir, "transcripts")).catch(() => [] as string[]));
  const details: Record<string, ScenarioDetail> = {};
  for (const s of scenarios) {
    const t = files.has(`${s.id}.json`) ? await readJson(path.join(dir, "transcripts", `${s.id}.json`), Transcript) : null;
    details[s.id] = { scenario: s, transcript: t ? { ...t, systemPrompt: null } : null, verdict: verdicts.get(s.id) ?? null };
  }
  return { runId: pointer.runId, note: pointer.note, summary, details };
}
