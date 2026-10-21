"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RunResponse } from "@/core/pipeline/status";
import { cn } from "@/lib/utils";
import { RunStepper } from "./RunStepper";
import { sendJson, usePoll } from "./usePoll";

type Defaults = { spendCapUsd: number; concurrency: number; agentUrl: string | null; agentName: string | null };

export function CollisionsClient({ initial, defaults }: { initial: RunResponse; defaults: Defaults }) {
  const router = useRouter();
  const runId = initial.run.id;
  const { data, refresh } = usePoll<RunResponse>(`/api/runs/${runId}`, 1000, (d) => d.run.status === "mapping_collisions", initial);
  const { run, rules, collisions } = data;
  const [cap, setCap] = useState(String(defaults.spendCapUsd));
  const [concurrency, setConcurrency] = useState(String(defaults.concurrency));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const byId = new Map(rules.map((r) => [r.id, r]));
  const ready = run.status === "awaiting_collision_review";

  useEffect(() => {
    if (["generating", "executing", "reporting", "complete", "halted"].includes(run.status)) router.push(`/runs/${runId}/report`);
  }, [run.status, router, runId]);

  async function toggle(id: string, dismissed: boolean) {
    setError(null);
    try {
      await sendJson(`/api/runs/${runId}/collisions`, "PATCH", dismissed ? { restore: [id] } : { dismiss: [id] });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function runTests(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const spendCapUsd = Number(cap);
    const conc = Number(concurrency);
    if (!(spendCapUsd > 0)) {
      setError("Set a test budget above $0.");
      return;
    }
    setBusy(true);
    try {
      await sendJson(`/api/runs/${runId}/execute`, "POST", { spendCapUsd, concurrency: Math.max(1, Math.min(16, Math.round(conc) || 1)) });
      router.push(`/runs/${runId}/report`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const tested = rules.filter((r) => !r.parked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Run {run.id}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{run.policyName}</h1>
        </div>
        <RunStepper runId={runId} status={run.status} />
      </div>

      {run.status === "mapping_collisions" && <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">Looking for rules that collide…</p>}
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Collisions</h2>
          <p className="text-sm text-zinc-500">
            Pairs of rules that both apply to one realistic situation and point opposite ways, with nothing in the policy saying which wins. Each kept pair becomes a
            forced-conflict test; dismiss any that are not genuine.
          </p>
          {ready && collisions.length === 0 && <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">No collisions proposed.</p>}
          {collisions.map((c) => (
            <article key={c.id} className={cn("rounded-xl border bg-white p-4", c.dismissed ? "border-zinc-200 opacity-60" : "border-red-200")} data-testid={`collision-${c.id}`}>
              <div className="flex items-start gap-3">
                <Badge variant={c.dismissed ? "secondary" : "destructive"}>{c.dismissed ? "dismissed" : "collision"}</Badge>
                <p className="flex-1 text-sm font-medium">{c.scenario}</p>
                <Button size="sm" variant="outline" disabled={!ready} onClick={() => toggle(c.id, c.dismissed)}>
                  {c.dismissed ? "Restore" : "Dismiss"}
                </Button>
              </div>
              <dl className="mt-3 grid gap-2 text-sm">
                {[c.ruleA, c.ruleB].map((id, i) => (
                  <div key={id} className="flex gap-2">
                    <dt className="w-16 shrink-0 text-zinc-500">{i === 0 ? "Rule A" : "Rule B"}</dt>
                    <dd>
                      <span className="text-zinc-500">#{byId.get(id)?.index}</span> {byId.get(id)?.statement ?? id}
                    </dd>
                  </div>
                ))}
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-zinc-500">Why</dt>
                  <dd className="text-zinc-600">{c.whyConflict}</dd>
                </div>
              </dl>
            </article>
          ))}
        </section>

        <form onSubmit={runTests} className="h-fit space-y-4 rounded-xl border border-zinc-200 bg-white p-4" data-testid="run-panel">
          <h2 className="text-lg font-semibold">Run tests</h2>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Agent under test</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="target" defaultChecked className="mt-1" />
              <span>
                {run.config.targetModel} with this policy as its system prompt
                <span className="block text-xs text-zinc-500">via {run.config.provider}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-zinc-400">
              <input type="radio" name="target" disabled className="mt-1" />
              <span>
                {defaults.agentName ?? "An HTTP agent"} {defaults.agentUrl ? `(${defaults.agentUrl})` : ""}
                <span className="block text-xs">Live agents over HTTP are wired on Saturday; set TENET_AGENT_URL to point at one.</span>
              </span>
            </label>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cap">Test budget (USD)</Label>
              <Input id="cap" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="concurrency">Concurrency</Label>
              <Input id="concurrency" inputMode="numeric" value={concurrency} onChange={(e) => setConcurrency(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            {tested} rules will be tested with the test their type demands. The run halts cleanly if the test budget is reached; analysis spend so far is not counted against it.
          </p>
          <Button type="submit" className="w-full" disabled={!ready || busy} data-testid="run-tests">
            {busy ? "Starting…" : "Run tests"}
          </Button>
        </form>
      </div>
    </div>
  );
}
