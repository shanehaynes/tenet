"use client";

import { useState } from "react";
import { ReportDocument } from "@/core/report/ReportDocument";
import { reportCss } from "@/core/report/reportCss";
import type { Summary } from "@/core/schemas/summary";
import { TranscriptSheet, type Detail } from "./TranscriptSheet";

/** The report for a run read from files (the archived example), with the transcript drawer fed from props. */
export function StaticReport({ summary, details, note }: { summary: Summary; details: Record<string, Detail>; note: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <style>{reportCss}</style>
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950" data-testid="example-note">
        <p>
          <span className="font-medium">Archived example run</span> · {new Date(summary.generatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })} · rendered from saved files, no
          model calls ·{" "}
          <a className="underline" href={`/example/report.html`} download>
            Download the standalone report
          </a>
        </p>
        <details className="mt-1">
          <summary className="cursor-pointer text-indigo-800">How this run was made</summary>
          <p className="mt-1">{note}</p>
        </details>
      </div>
      <div
        className="rounded-xl border border-zinc-200 bg-white p-6"
        onClick={(e) => {
          const id = (e.target as Element).closest("[data-scenario-id]")?.getAttribute("data-scenario-id");
          if (id) setOpen(id);
        }}
      >
        <ReportDocument summary={summary} />
      </div>
      <TranscriptSheet runId={summary.runId} scenarioId={open} onClose={() => setOpen(null)} details={details} />
    </div>
  );
}
