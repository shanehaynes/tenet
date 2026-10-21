import type { Collision, Rule, Run, RunEvent, RunStatus } from "../schemas/records";
import { appendEvent, readEvents, readRun, readRunFile, withRun } from "../store/runs";
import { readRunUsage } from "../store/usage";
import { confirmBlockers } from "./analysis";
import { spendFromUsage } from "./budget";
import { isJobRunning } from "./jobs";

// Reading a run for the UI and CLI, with liveness: a run left in a working state with no live job and a stale
// heartbeat was interrupted (the process died or the dev server restarted).

export const WORKING: ReadonlySet<RunStatus> = new Set<RunStatus>([
  "created",
  "scanning",
  "decomposing",
  "classifying",
  "mapping_collisions",
  "generating",
  "executing",
  "reporting",
]);

const STALE_MS = 60_000;

export async function detectInterrupted(run: Run, now = Date.now()): Promise<Run> {
  if (!WORKING.has(run.status) || isJobRunning(run.id)) return run;
  const last = Date.parse(run.heartbeatAt ?? run.updatedAt);
  if (Number.isFinite(last) && now - last < STALE_MS) return run;
  const reason = `Interrupted during ${run.status}: the process running it stopped. Run it again.`;
  const updated = await withRun(run.id, async (tx) => {
    const current = await tx.get("run");
    if (!WORKING.has(current.status)) return current;
    const next: Run = { ...current, status: "interrupted", statusReason: reason };
    tx.set("run", next);
    return next;
  });
  await appendEvent(run.id, { level: "warn", stage: "interrupted", message: reason });
  return updated;
}

export type RunView = { run: Run; rules: Rule[]; collisions: Collision[]; events: RunEvent[]; live: boolean };

export async function readRunView(runId: string, opts: { events?: number } = {}): Promise<RunView> {
  const run = await detectInterrupted(await readRun(runId));
  const [rules, collisions, events] = await Promise.all([
    readRunFile(runId, "rules"),
    readRunFile(runId, "collisions"),
    readEvents(runId, opts.events ?? 30),
  ]);
  return { run, rules, collisions, events, live: isJobRunning(runId) };
}

export type RunProgress = {
  rulesTotal: number;
  rulesClassified: number;
  confirmBlockers: string[];
  scenarios: { total: number; pending: number; done: number; notRun: number };
  judged: number;
  spend: { analysisUsd: number; testUsd: number; capUsd: number; calls: number };
  live: boolean;
};

export type RunResponse = RunView & { progress: RunProgress };

/** What GET /api/runs/:id returns and what run pages render first: the view plus progress counters. */
export async function buildRunResponse(runId: string): Promise<RunResponse> {
  const view = await readRunView(runId);
  const [scenarios, verdicts, usage] = await Promise.all([readRunFile(runId, "scenarios"), readRunFile(runId, "verdicts"), readRunUsage(runId)]);
  const spent = spendFromUsage(usage);
  return {
    ...view,
    progress: {
      rulesTotal: view.rules.length,
      rulesClassified: view.rules.filter((r) => r.proposedType !== null || r.rationale !== null).length,
      confirmBlockers: view.run.status === "awaiting_review" ? confirmBlockers(view.rules, view.run.config.ambiguityThreshold) : [],
      scenarios: {
        total: scenarios.length,
        pending: scenarios.filter((s) => s.status === "pending" || s.status === "running").length,
        done: scenarios.filter((s) => s.status === "done").length,
        notRun: scenarios.filter((s) => s.status === "not_run").length,
      },
      judged: verdicts.length,
      spend: { analysisUsd: spent.analysisUsd, testUsd: spent.testUsd, capUsd: view.run.config.spendCapUsd, calls: spent.calls },
      live: view.live,
    },
  };
}
