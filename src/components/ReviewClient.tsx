"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { RunResponse } from "@/core/pipeline/status";
import { TYPE_DEFINITIONS } from "@/core/agents/prompts/shared";
import { AmbiguityMap } from "@/core/report/AmbiguityMap";
import { reportCss } from "@/core/report/reportCss";
import { RULE_TYPES, type RuleType } from "@/core/schemas/agents";
import { effectiveType, type Rule } from "@/core/schemas/records";
import { cn } from "@/lib/utils";
import { RunStepper } from "./RunStepper";
import { sendJson, usePoll } from "./usePoll";

const WORKING = new Set(["created", "scanning", "decomposing", "classifying", "mapping_collisions"]);

const STAGE_TEXT: Record<string, string> = {
  created: "Starting…",
  scanning: "Checking the policy for injected instructions…",
  decomposing: "Splitting the policy into rules…",
  classifying: "Classifying each rule…",
  mapping_collisions: "Looking for rules that collide…",
};

function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-zinc-400">—</span>;
  return (
    <span className="inline-flex items-center gap-2" title={`confidence ${value.toFixed(2)}`}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200">
        <span className={cn("block h-full", value < 0.7 ? "bg-amber-500" : "bg-indigo-700")} style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="tabular-nums text-xs text-zinc-500">{value.toFixed(2)}</span>
    </span>
  );
}

export function ReviewClient({ initial }: { initial: RunResponse }) {
  const router = useRouter();
  const runId = initial.run.id;
  const [confirming, setConfirming] = useState(false);
  const { data, refresh } = usePoll<RunResponse>(`/api/runs/${runId}`, 1000, (d) => confirming || WORKING.has(d.run.status), initial);
  const { run, rules, collisions, progress } = data;
  const threshold = run.config.ambiguityThreshold;
  const editable = run.status === "awaiting_review";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [splitting, setSplitting] = useState<Rule | null>(null);
  const [parts, setParts] = useState<string[]>(["", ""]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (run.status === "awaiting_collision_review") router.push(`/runs/${runId}/collisions`);
  }, [run.status, router, runId]);

  async function apply(ops: unknown[]) {
    setError(null);
    setBusy(true);
    try {
      await sendJson(`/api/runs/${runId}/rules`, "PATCH", { ops });
      await refresh();
      setSelected(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      await sendJson(`/api/runs/${runId}/confirm`, "POST", {});
      setConfirming(true);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const nodes = useMemo(
    () => rules.map((r) => ({ ruleId: r.id, index: r.index, statement: r.statement, probabilities: r.probabilities, parked: r.parked, verdict: null })),
    [rules],
  );
  const parked = rules.filter((r) => r.parked).length;
  const toConfirm = rules.length - parked;

  return (
    <div className="space-y-6">
      <style>{reportCss}</style>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Run {run.id}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{run.policyName}</h1>
        </div>
        <RunStepper runId={runId} status={run.status} />
      </div>

      {run.status === "quarantined" && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">Quarantined before any agent saw it.</p>
          <p className="mt-1">{run.statusReason}</p>
          <Link href="/" className="mt-2 inline-block underline">
            Back to policies
          </Link>
        </div>
      )}
      {(run.status === "failed" || run.status === "interrupted" || run.status === "cancelled") && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">The analysis {run.status === "failed" ? "failed" : run.status}.</p>
          <p className="mt-1">{run.statusReason}</p>
        </div>
      )}
      {run.status === "complete" && rules.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="font-medium">This policy contains no testable rules.</p>
          {run.untestablePassages.length > 0 && <p className="mt-1 text-sm text-zinc-600">Set aside: {run.untestablePassages.map((p) => `“${p}”`).join("; ")}</p>}
        </div>
      )}

      {WORKING.has(run.status) && (
        <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4" aria-live="polite">
          <p className="text-sm font-medium">{STAGE_TEXT[run.status] ?? run.status}</p>
          <Progress value={run.status === "classifying" && progress.rulesTotal ? (100 * progress.rulesClassified) / progress.rulesTotal : run.status === "mapping_collisions" ? 90 : 15} />
          {run.status === "classifying" && (
            <p className="text-xs text-zinc-500">
              {progress.rulesClassified} of {progress.rulesTotal} rules classified
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {rules.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Rules</h2>
            <p className="text-sm text-zinc-500">
              Check each rule&apos;s type. Low-confidence rules are pre-parked: give them a type to test them, or leave them parked as ambiguous.
            </p>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" disabled={!editable || selected.size < 2 || busy} onClick={() => apply([{ merge: { ruleIds: [...selected] } }])}>
                Merge selected{selected.size >= 2 ? ` (${selected.size})` : ""}
              </Button>
              <Button disabled={!editable || busy || progress.confirmBlockers.length > 0} onClick={confirm} data-testid="confirm-rules">
                Confirm {toConfirm} rule{toConfirm === 1 ? "" : "s"} ({parked} parked)
              </Button>
            </div>
          </div>
          {editable && progress.confirmBlockers.length > 0 && (
            <p className="text-sm text-amber-800" data-testid="confirm-blockers">
              Confirm is waiting on: {progress.confirmBlockers.join(" ")}
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="w-8 px-3 py-2" aria-label="Select" />
                  <th className="w-10 px-2 py-2">#</th>
                  <th className="px-2 py-2">Rule</th>
                  <th className="w-44 px-2 py-2">Proposed</th>
                  <th className="w-40 px-2 py-2">Type</th>
                  <th className="w-16 px-2 py-2">Park</th>
                  <th className="w-16 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => {
                  const eff = effectiveType(r, threshold);
                  const low = r.confidence !== null && r.confidence < threshold;
                  const open = expanded.has(r.id);
                  return (
                    <tr key={r.id} className={cn("border-b border-zinc-100 align-top last:border-0", low && "bg-amber-50/60", r.parked && "text-zinc-500")} data-testid={`rule-row-${r.id}`}>
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Select rule ${r.index}`}
                          disabled={!editable}
                          checked={selected.has(r.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(r.id);
                            else next.delete(r.id);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-2.5 tabular-nums text-zinc-500">{r.index}</td>
                      <td className="px-2 py-2.5">
                        <button type="button" className="text-left" onClick={() => setExpanded((s) => new Set(s.has(r.id) ? [...s].filter((x) => x !== r.id) : [...s, r.id]))}>
                          <span className="font-medium text-zinc-900">{r.statement}</span>
                        </button>
                        {(open || !r.located) && (
                          <p className={cn("mt-1 font-mono text-xs text-zinc-500", !r.located && "underline decoration-dotted")} title={r.located ? undefined : "source not located in the policy text"}>
                            “{r.quote}”{r.section ? ` · ${r.section}` : ""}
                          </p>
                        )}
                        {open && r.rationale && <p className="mt-1 text-xs text-zinc-600">{r.rationale}</p>}
                        {open && r.ambiguityNote && <p className="mt-1 text-xs text-amber-800">{r.ambiguityNote}</p>}
                        {r.origin !== "extracted" && <p className="mt-1 text-xs text-zinc-500">{r.origin === "split" ? "Split" : "Merged"} from {r.parentIds.join(", ")}</p>}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="text-zinc-700">{r.proposedType ?? "—"}</div>
                        <ConfidenceBar value={r.confidence} />
                      </td>
                      <td className="px-2 py-2.5">
                        <select
                          aria-label={`Type for rule ${r.index}`}
                          className="h-8 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm disabled:opacity-60"
                          value={eff ?? ""}
                          disabled={!editable || busy}
                          onChange={(e) => e.target.value && apply([{ set_type: { ruleId: r.id, type: e.target.value as RuleType } }])}
                        >
                          <option value="">{r.parked ? "parked" : "choose…"}</option>
                          {RULE_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Park rule ${r.index}`}
                          checked={r.parked}
                          disabled={!editable || busy}
                          onChange={(e) => apply([e.target.checked ? { park: { ruleId: r.id } } : { unpark: { ruleId: r.id } }])}
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={!editable || busy}
                          onClick={() => {
                            setSplitting(r);
                            setParts(["", ""]);
                          }}
                        >
                          Split
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Ambiguity map</h2>
            <p className="text-sm text-zinc-500">Each rule sits between the four types according to the classifier&apos;s probabilities. Rules outside the shaded corners are ones the policy&apos;s authors never pinned down.</p>
            <div className="mt-2 grid gap-6 lg:grid-cols-[640px_1fr]">
              <AmbiguityMap nodes={nodes} arcs={collisions.map((c) => ({ id: c.id, ruleA: c.ruleA, ruleB: c.ruleB, dismissed: c.dismissed }))} threshold={threshold} />
              <dl className="space-y-3 text-sm" data-testid="type-legend">
                {(["constraint", "tradeoff", "disposition", "ordering", "ambiguous"] as const).map((t) => {
                  const [name, ...rest] = TYPE_DEFINITIONS[t].split(" — ");
                  return (
                    <div key={t}>
                      <dt className="font-medium">{name}</dt>
                      <dd className="text-zinc-600">{rest.join(" — ")}</dd>
                    </div>
                  );
                })}
                <div>
                  <dt className="font-medium">What each type is tested with</dt>
                  <dd className="text-zinc-600">Constraints: a six-step pressure ladder (a stakes sweep when the rule has a numeric trigger). Tradeoffs: a stakes sweep. Dispositions: ten paraphrases. Orderings: forced conflicts.</dd>
                </div>
              </dl>
            </div>
          </section>
        </section>
      )}

      <Dialog open={splitting !== null} onOpenChange={(o) => !o && setSplitting(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Split rule {splitting?.index}</DialogTitle>
            <DialogDescription>{splitting?.statement}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {parts.map((p, i) => (
              <Textarea key={i} value={p} rows={2} placeholder={`Rule ${i + 1}`} onChange={(e) => setParts(parts.map((x, j) => (j === i ? e.target.value : x)))} />
            ))}
            {parts.length < 6 && (
              <Button size="sm" variant="ghost" onClick={() => setParts([...parts, ""])}>
                Add another
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button
              disabled={parts.filter((p) => p.trim()).length < 2 || busy}
              onClick={async () => {
                const statements = parts.map((p) => p.trim()).filter(Boolean);
                const id = splitting!.id;
                setSplitting(null);
                await apply([{ split: { ruleId: id, statements } }]);
              }}
            >
              Split into {parts.filter((p) => p.trim()).length} rules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
