"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { actionOutcome, type Scenario, type TargetAction, type Transcript, type Verdict } from "@/core/schemas/records";
import { cn } from "@/lib/utils";

export type Detail = { scenario: Scenario; transcript: Transcript | null; verdict: Verdict | null };

/** The transcript drawer: one scenario's message, the agent's reply, the judge's verdict and quoted evidence. */
export function TranscriptSheet({
  runId,
  scenarioId,
  onClose,
  details,
}: {
  runId: string;
  scenarioId: string | null;
  onClose: () => void;
  /** Static details (the archived example run); otherwise the drawer fetches from the API. */
  details?: Record<string, Detail>;
}) {
  const [fetched, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const detail = details && scenarioId ? (details[scenarioId] ?? null) : fetched;
  useEffect(() => {
    if (!scenarioId || details) return;
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
  }, [runId, scenarioId, details]);
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
                {shown.transcript.actions.length === 0 ? (
                  <p className="text-xs text-zinc-500">No tool calls.</p>
                ) : (
                  <ol className="space-y-2 text-xs" data-testid="actions">
                    {shown.transcript.actions.map((a, i) => (
                      <ActionItem key={i} index={i + 1} action={a} />
                    ))}
                  </ol>
                )}
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

const RESULT_CHARS = 300;

/** One tool call: arguments as readable text (a drafted reply keeps its line breaks), the result clipped, a tool refusal flagged. */
function ActionItem({ index, action }: { index: number; action: TargetAction }) {
  const outcome = actionOutcome(action);
  const refused = outcome.kind === "refused";
  const args = action.arguments && typeof action.arguments === "object" && !Array.isArray(action.arguments) ? Object.entries(action.arguments as Record<string, unknown>) : null;
  const resultText = JSON.stringify(action.result) ?? "";
  return (
    <li className={cn("rounded-lg border p-2", refused ? "border-red-200 bg-red-50/60" : "border-zinc-200")}>
      <p className="font-mono font-semibold">
        {index}. {action.name}
        {refused && <span className="ml-2 font-sans text-[11px] font-semibold text-red-800">refused by the tool{outcome.error ? `: ${outcome.error}` : ""}</span>}
        {outcome.kind === "malformed" && <span className="ml-2 font-sans text-[11px] font-semibold text-zinc-500">rejected: malformed arguments</span>}
      </p>
      {args ? (
        args.length > 0 && (
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            {args.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-zinc-500">{k}</dt>
                <dd className="whitespace-pre-wrap break-words">{typeof v === "string" ? v : JSON.stringify(v)}</dd>
              </div>
            ))}
          </dl>
        )
      ) : (
        <p className="mt-1 break-all font-mono text-zinc-600">{JSON.stringify(action.arguments)}</p>
      )}
      <p className="mt-1 break-all font-mono text-zinc-500" title={resultText.length > RESULT_CHARS ? resultText : undefined}>
        → {resultText.length > RESULT_CHARS ? `${resultText.slice(0, RESULT_CHARS)}…` : resultText}
      </p>
    </li>
  );
}
