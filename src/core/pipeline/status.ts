import type { Collision, Rule, Run, RunEvent, RunStatus } from "../schemas/records";
import { appendEvent, readEvents, readRun, readRunFile, withRun } from "../store/runs";
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
