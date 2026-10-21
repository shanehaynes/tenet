import type { RunStatus } from "../schemas/records";
import { appendEvent, withRun } from "../store/runs";
import { readRunUsage, totalsFromUsage } from "../store/usage";

// Shared run-state helpers for the analysis and execution pipelines: status changes with an event line, a
// heartbeat while a job is live (so a dead process is detected as interrupted), totals refreshed from the
// usage log, and a readable failure.

const HEARTBEAT_MS = 5_000;

export async function setStatus(runId: string, status: RunStatus, statusReason: string | null = null): Promise<void> {
  await withRun(runId, async (tx) => {
    const run = await tx.get("run");
    tx.set("run", { ...run, status, statusReason });
  });
  await appendEvent(runId, { stage: status, message: statusReason ?? `status: ${status}` });
}

export function startHeartbeat(runId: string): () => void {
  const beat = () =>
    withRun(runId, async (tx) => {
      const run = await tx.get("run");
      tx.set("run", { ...run, heartbeatAt: new Date().toISOString() });
    }).catch(() => undefined);
  void beat();
  const timer = setInterval(beat, HEARTBEAT_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}

export async function refreshTotals(runId: string): Promise<void> {
  const totals = totalsFromUsage(await readRunUsage(runId));
  await withRun(runId, async (tx) => {
    const run = await tx.get("run");
    tx.set("run", { ...run, totals });
  });
}

export function reasonFor(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function failRun(runId: string, err: unknown, signal?: AbortSignal): Promise<void> {
  const cancelled = signal?.aborted ?? false;
  await withRun(runId, async (tx) => {
    const run = await tx.get("run");
    tx.set("run", {
      ...run,
      status: cancelled ? "cancelled" : "failed",
      statusReason: cancelled ? "Cancelled" : reasonFor(err),
      finishedAt: new Date().toISOString(),
    });
  }).catch(() => undefined);
  await appendEvent(runId, { level: "error", stage: "failed", message: reasonFor(err) }).catch(() => undefined);
}

