"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { RunResponse } from "@/core/pipeline/status";
import { formatUsd } from "@/core/report/palette";
import { ReportDocument } from "@/core/report/ReportDocument";
import { reportCss } from "@/core/report/reportCss";
import type { Summary } from "@/core/schemas/summary";
import { RunStepper } from "./RunStepper";
import { TranscriptSheet } from "./TranscriptSheet";
import { usePoll } from "./usePoll";

const ACTIVE = new Set(["generating", "executing", "reporting"]);
const STAGE: Record<string, string> = { generating: "Writing the tests", executing: "Running and judging the tests", reporting: "Summarizing policy defects" };

export function LiveReport({ initialRun, initialSummary }: { initialRun: RunResponse; initialSummary: Summary }) {
  const runId = initialRun.run.id;
  const { data } = usePoll<RunResponse>(`/api/runs/${runId}`, 1500, (d) => ACTIVE.has(d.run.status), initialRun);
  const active = ACTIVE.has(data.run.status);
  const [summaryActive, setSummaryActive] = useState(ACTIVE.has(initialRun.run.status));
  const { data: summary } = usePoll<Summary>(`/api/runs/${runId}/summary.json`, 2000, summaryActive, initialSummary);
  const [open, setOpen] = useState<string | null>(null);
  const { run, progress, events } = data;

  // Keep polling the summary until one poll after the run stops, so the final summary lands.
  useEffect(() => {
    if (active) return;
    const t = setTimeout(() => setSummaryActive(false), 2500);
    return () => clearTimeout(t);
  }, [active]);

  const notStarted = ["created", "scanning", "decomposing", "classifying", "awaiting_review", "mapping_collisions", "awaiting_collision_review"].includes(run.status);
  const s = progress.scenarios;
  const pct = s.total ? Math.round((100 * (progress.judged + s.notRun)) / s.total) : 0;
  // Elapsed time from server timestamps (the heartbeat moves every 5 s while a run is live), so render stays pure.
  const until = run.finishedAt ?? run.heartbeatAt ?? run.updatedAt;
  const elapsed = run.startedExecutionAt ? Math.max(0, Math.round((Date.parse(until) - Date.parse(run.startedExecutionAt)) / 1000)) : null;

  return (
    <div className="space-y-6">
      <style>{reportCss}</style>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Run {run.id}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Report</h1>
        </div>
        <RunStepper runId={runId} status={run.status} />
      </div>

      {notStarted && (
        <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
          Tests have not started yet. <Link className="underline" href={`/runs/${runId}`}>Continue setting up the run</Link>.
        </p>
      )}

      {!notStarted && (
        <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4" aria-live="polite" data-testid="run-header">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="font-medium">{active ? STAGE[run.status] : run.status === "complete" ? "Complete" : run.status === "halted" ? "Halted" : run.status}</span>
            <span className="tabular-nums text-zinc-600">
              {s.total} scenarios · {progress.judged} judged{s.notRun ? ` · ${s.notRun} not run` : ""}
            </span>
            <span className="tabular-nums text-zinc-600">
              test spend {formatUsd(progress.spend.testUsd)} of {formatUsd(progress.spend.capUsd)} · analysis {formatUsd(progress.spend.analysisUsd)}
            </span>
            {elapsed !== null && <span className="tabular-nums text-zinc-600">{elapsed} s</span>}
            <span className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" render={<a href={`/api/runs/${runId}/summary.json`} download={`summary-${runId}.json`} />}>
                Summary JSON
              </Button>
            </span>
          </div>
          {active && <Progress value={run.status === "generating" ? 5 : pct} />}
          {run.status === "halted" && (
            <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900" data-testid="halted-panel">
              <p className="font-semibold">{progress.judged === 0 ? "Halted before execution." : "Halted."}</p>
              <p>{run.statusReason}</p>
              <p className="mt-1 text-xs">Scenarios that did not run are marked “not run”; nothing is counted as a pass.</p>
            </div>
          )}
          {(run.status === "failed" || run.status === "interrupted") && (
            <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              <p className="font-semibold">The run {run.status}.</p>
              <p>{run.statusReason}</p>
            </div>
          )}
          {active && events.length > 0 && (
            <ol className="max-h-32 overflow-y-auto font-mono text-xs text-zinc-500">
              {events
                .slice(-10)
                .reverse()
                .map((e, i) => (
                  <li key={`${e.ts}-${i}`} className={e.level === "warn" ? "text-amber-700" : e.level === "error" ? "text-red-700" : undefined}>
                    {new Date(e.ts).toLocaleTimeString("en-US")} {e.message}
                  </li>
                ))}
            </ol>
          )}
        </section>
      )}

      {!notStarted && (
        <div
          className="rounded-xl border border-zinc-200 bg-white p-6"
          onClick={(e) => {
            const el = (e.target as Element).closest("[data-scenario-id]");
            const id = el?.getAttribute("data-scenario-id");
            if (id) setOpen(id);
          }}
        >
          <ReportDocument summary={summary} liveNote={active ? "Live: results fill in as the judge returns verdicts." : undefined} />
        </div>
      )}
      <TranscriptSheet runId={runId} scenarioId={open} onClose={() => setOpen(null)} />
    </div>
  );
}
