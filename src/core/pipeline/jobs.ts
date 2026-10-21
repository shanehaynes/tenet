// In-process job registry (architecture §7). Route handlers start a job and return 202; the UI polls. The
// registry lives on globalThis so Next's HMR does not create a second one mid-run.

type Job = { kind: string; promise: Promise<void>; abort: AbortController; startedAt: number };
const g = globalThis as unknown as { __tenetJobs?: Map<string, Job> };
const jobs = (g.__tenetJobs ??= new Map());

export function isJobRunning(runId: string): boolean {
  return jobs.has(runId);
}

export function jobKind(runId: string): string | null {
  return jobs.get(runId)?.kind ?? null;
}

/** Starts fn in the background unless a job for this run is already live. Errors are the job's to record. */
export function startJob(runId: string, kind: string, fn: (signal: AbortSignal) => Promise<void>): Promise<void> {
  const existing = jobs.get(runId);
  if (existing) return existing.promise;
  const abort = new AbortController();
  const promise = (async () => {
    try {
      await fn(abort.signal);
    } finally {
      jobs.delete(runId);
    }
  })();
  jobs.set(runId, { kind, promise, abort, startedAt: Date.now() });
  return promise;
}

export function cancelJob(runId: string): boolean {
  const job = jobs.get(runId);
  if (!job) return false;
  job.abort.abort();
  return true;
}

/** Waits for a run's live job, if any (CLI and tests). */
export async function waitForJob(runId: string): Promise<void> {
  await jobs.get(runId)?.promise;
}
