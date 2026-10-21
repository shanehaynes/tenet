import { readFile } from "node:fs/promises";
import path from "node:path";
import { settings } from "../config";
import { LabelsFile } from "../eval/classifierEval";
import { readCapabilitiesFile } from "../model/capabilities";
import { capabilitiesKey } from "../schemas/capabilities";
import type { Transcript } from "../schemas/records";
import { Summary } from "../schemas/summary";
import { readJson, writeJsonAtomic } from "../store/fs";
import { readPolicy, samplesDir } from "../store/policies";
import { readRun, readRunFile, readTranscript, runFilePath } from "../store/runs";
import { readRunUsage } from "../store/usage";
import { buildSummary, type PlantedInput } from "./aggregate";

// Builds a run's Summary from disk. The live report calls this while a run is executing; the pipeline writes
// the final one to summary.json when the run completes or halts.

async function plantedFor(policyId: string): Promise<PlantedInput | null> {
  const policy = await readPolicy(policyId);
  if (policy?.sample?.key !== "harrow-vale") return null;
  try {
    const labels = LabelsFile.parse(JSON.parse(await readFile(path.join(samplesDir(), "harrow-vale.labels.json"), "utf8")));
    return { policyText: policy.text, labels };
  } catch {
    return null;
  }
}

export async function computeSummary(runId: string, summaries?: Map<string, string>): Promise<Summary> {
  const run = await readRun(runId);
  const [rules, collisions, scenarios, designs, verdicts, usage, caps, planted] = await Promise.all([
    readRunFile(runId, "rules"),
    readRunFile(runId, "collisions"),
    readRunFile(runId, "scenarios"),
    readRunFile(runId, "designs"),
    readRunFile(runId, "verdicts"),
    readRunUsage(runId),
    readCapabilitiesFile(),
    plantedFor(run.policyId),
  ]);
  const capabilities = run.config.provider === "mock" ? null : (caps[capabilitiesKey(run.config.provider, settings().targetModel)] ?? null);
  return buildSummary({ run, rules, collisions, scenarios, designs, verdicts, usage, summaries, capabilities, planted });
}

export async function writeSummary(runId: string, summaries?: Map<string, string>): Promise<Summary> {
  const summary = await computeSummary(runId, summaries);
  await writeJsonAtomic(runFilePath(runId, "summary.json"), summary);
  return summary;
}

/** The saved summary when the run is finished, otherwise one computed from the current state. */
export async function readOrComputeSummary(runId: string): Promise<Summary> {
  const run = await readRun(runId);
  if (["complete", "halted", "failed", "cancelled", "interrupted"].includes(run.status)) {
    const saved = await readJson(runFilePath(runId, "summary.json"), Summary).catch(() => null);
    if (saved) return saved;
  }
  return computeSummary(runId);
}

/** Every transcript the run has, keyed by scenario id (the export inlines them). */
export async function readAllTranscripts(runId: string): Promise<Record<string, Transcript>> {
  const scenarios = await readRunFile(runId, "scenarios");
  const out: Record<string, Transcript> = {};
  for (const s of scenarios) {
    const t = await readTranscript(runId, s.id);
    if (t) out[s.id] = t;
  }
  return out;
}
