"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Scenario, Transcript, Verdict } from "@/core/schemas/records";

type Detail = { scenario: Scenario; transcript: Transcript | null; verdict: Verdict | null };

/** The transcript drawer: one scenario's message, the agent's reply, the judge's verdict and quoted evidence. */
export function TranscriptSheet({ runId, scenarioId, onClose }: { runId: string; scenarioId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!scenarioId) return;
    let alive = true;
    fetch(`/api/runs/${runId}/scenarios/${scenarioId}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`);
        if (alive) {
          setDetail(body);
          setError(null);
        }
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [runId, scenarioId]);
  const shown = detail && detail.scenario.id === scenarioId ? detail : null;
  const s = shown?.scenario;
  const reply = shown?.transcript?.messages.find((m) => m.role === "assistant")?.content;
  return (
    <Sheet open={scenarioId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl" data-testid="transcript-drawer">
        <SheetHeader>
          <SheetTitle>Transcript {scenarioId}</SheetTitle>
          <SheetDescription>
            {s ? `${s.kind}${s.tactic ? ` · ${s.tactic.replace(/_/g, " ")}` : ""}${s.label && !s.tactic ? ` · ${s.label}` : ""}` : error ?? "Loading…"}
          </SheetDescription>
        </SheetHeader>
        {shown && (
          <div className="space-y-4 px-4 pb-6 text-sm">
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">User</h3>
              <p className="whitespace-pre-wrap rounded-lg bg-zinc-100 p-3">{shown.scenario.userTurn}</p>
            </section>
            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Agent</h3>
              <p className="whitespace-pre-wrap rounded-lg border border-zinc-200 p-3">{reply ?? (shown.scenario.error ? `Not run: ${shown.scenario.error}` : "No reply recorded.")}</p>
              {shown.transcript?.truncated && <p className="mt-1 text-xs text-amber-700">The reply was cut off by the token limit.</p>}
            </section>
            {shown.transcript?.actions && (
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Actions</h3>
                <table className="w-full text-xs">
                  <tbody>
                    {shown.transcript.actions.map((a, i) => (
                      <tr key={i} className="border-b border-zinc-100 align-top">
                        <td className="py-1 pr-2 font-mono">{a.name}</td>
                        <td className="py-1 pr-2 font-mono text-zinc-600">{JSON.stringify(a.arguments)}</td>
                        <td className="py-1 font-mono text-zinc-600">{JSON.stringify(a.result)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            {shown.verdict && (
              <section className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-900">Judge</h3>
                <p>
                  <span className="font-semibold">{shown.verdict.verdict}</span> · confidence {shown.verdict.confidence.toFixed(2)}
                  {!shown.verdict.verified && <span className="ml-2 text-xs font-semibold text-slate-600">evidence unverified</span>}
                </p>
                {shown.verdict.evidence && <blockquote className="mt-2 border-l-2 border-indigo-700 pl-2 italic">“{shown.verdict.evidence}”</blockquote>}
                {shown.verdict.note && <p className="mt-2 text-zinc-700">{shown.verdict.note}</p>}
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
