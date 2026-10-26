"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ScanFinding } from "@/core/schemas/agents";
import { sendJson } from "./usePoll";

export type PolicyItem = {
  id: string;
  name: string;
  source: "sample" | "paste" | "upload";
  sampleKey: string | null;
  role: "fictional" | "safety_demo" | "real_agent" | "published" | null;
  description: string;
  flagged: boolean;
  findings: ScanFinding[];
  text: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  fictional: "sample",
  real_agent: "real agent team",
  published: "published policy",
  safety_demo: "safety demo",
};

function QuarantineBanner({ findings, onEdit }: { findings: ScanFinding[]; onEdit?: () => void }) {
  const flags = findings.filter((f) => f.severity === "flag");
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
      <p className="font-semibold">Quarantined: this text tries to instruct the software that reads it.</p>
      <ul className="mt-2 space-y-1">
        {flags.map((f) => (
          <li key={f.line}>
            <span className="font-mono text-xs">line {f.line}</span> “{f.excerpt}” — {f.reason}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-red-800">No agent sees a quarantined policy. Edit the text and re-scan to continue.</p>
      {onEdit && (
        <Button size="sm" variant="outline" className="mt-2" onClick={onEdit}>
          Edit text and re-scan
        </Button>
      )}
    </div>
  );
}

function WarningNotice({ findings }: { findings: ScanFinding[] }) {
  const warnings = findings.filter((f) => f.severity === "warning");
  if (!warnings.length) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
      {warnings.map((w) => (
        <p key={`${w.line}-${w.reason}`}>
          Line {w.line}: {w.reason}
        </p>
      ))}
    </div>
  );
}

export function PolicyHome({ policies, seedError }: { policies: PolicyItem[]; seedError: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(seedError);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [created, setCreated] = useState<PolicyItem | null>(null);
  const [editing, setEditing] = useState<PolicyItem | null>(null);
  const [editText, setEditText] = useState("");

  const samples = policies.filter((p) => p.sampleKey && p.role !== "safety_demo");
  const demo = policies.filter((p) => p.role === "safety_demo");
  const mine = policies.filter((p) => !p.sampleKey);

  async function analyze(policyId: string) {
    setBusy(policyId);
    setError(null);
    try {
      const run = await sendJson<{ id: string }>("/api/runs", "POST", { policyId });
      router.push(`/runs/${run.id}/review`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file && !text.trim()) {
      setError("Paste a policy or choose a .txt or .md file first.");
      return;
    }
    setBusy("new");
    try {
      let policy: { id: string; name: string; flagged: boolean; scan: { findings: ScanFinding[] } | null; text: string };
      if (file) {
        const form = new FormData();
        form.set("file", file);
        form.set("name", name);
        const res = await fetch("/api/policies", { method: "POST", body: form });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
        policy = body;
      } else {
        policy = await sendJson("/api/policies", "POST", { name, text });
      }
      if (policy.flagged) {
        setCreated({ id: policy.id, name: policy.name, source: "paste", sampleKey: null, role: null, description: "", flagged: true, findings: policy.scan?.findings ?? [], text: policy.text });
        setBusy(null);
        return;
      }
      await analyze(policy.id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function rescan() {
    if (!editing) return;
    setBusy(editing.id);
    try {
      const p = await sendJson<{ id: string; flagged: boolean; scan: { findings: ScanFinding[] } | null; text: string }>(`/api/policies/${editing.id}/rescan`, "POST", { text: editText });
      if (p.flagged) {
        setEditing({ ...editing, findings: p.scan?.findings ?? [], text: p.text });
        setError("Still flagged: the edited text still contains instruction-like content.");
        setBusy(null);
        return;
      }
      setEditing(null);
      await analyze(p.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Test what your AI policy actually does</h1>
        <p className="mt-1 max-w-3xl text-zinc-600">
          Tenet splits a policy into rules, sorts each one by kind (a bright-line constraint, a tradeoff, a disposition, a priority ordering), runs the test that kind
          demands against the agent, and reports where its behavior departs from the policy and where the policy contradicts itself.
        </p>
        <p className="mt-3 text-sm text-zinc-600">
          <Link
            className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 font-medium text-indigo-900 hover:bg-indigo-100"
            href="/runs/example"
            data-testid="example-link"
          >
            See an example report
          </Link>{" "}
          <span className="ml-2">A real run of the demo policy, read from files in the repo; no key needed.</span>
        </p>
      </section>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Sample policies</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {samples.map((p) => (
              <div key={p.id} className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4" data-testid={`sample-${p.sampleKey}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{p.name}</h3>
                  {p.role && <Badge variant="secondary">{ROLE_LABEL[p.role]}</Badge>}
                </div>
                <p className="mt-1 flex-1 text-sm text-zinc-600">{p.description}</p>
                <WarningNotice findings={p.findings} />
                <Button className="mt-3 self-start" onClick={() => analyze(p.id)} disabled={busy !== null}>
                  {busy === p.id ? "Starting…" : "Analyze"}
                </Button>
              </div>
            ))}
          </div>

          {demo.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">Safety demo</h2>
              {demo.map((p) => (
                <div key={p.id} className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4" data-testid="safety-demo">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium">{p.name}</h3>
                    <Badge variant="destructive">{p.flagged ? "quarantined" : "safety demo"}</Badge>
                  </div>
                  <p className="text-sm text-zinc-600">{p.description}</p>
                  {p.flagged ? <QuarantineBanner findings={p.findings} /> : <Button onClick={() => analyze(p.id)}>Analyze</Button>}
                </div>
              ))}
            </>
          )}

          {mine.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">Your policies</h2>
              <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
                {mine.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-zinc-500">{p.description}</span>
                    {p.flagged ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto"
                        onClick={() => {
                          setEditing(p);
                          setEditText(p.text ?? "");
                        }}
                      >
                        Quarantined: edit and re-scan
                      </Button>
                    ) : (
                      <Button size="sm" className="ml-auto" onClick={() => analyze(p.id)} disabled={busy !== null}>
                        Analyze
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Your policy</h2>
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4" noValidate>
            <div className="space-y-1">
              <Label htmlFor="policy-name">Name</Label>
              <Input id="policy-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Support agent policy, v3" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="policy-text">Paste the policy</Label>
              <Textarea id="policy-text" value={text} onChange={(e) => setText(e.target.value)} rows={12} placeholder="Paste the rules your agent is meant to follow…" className="font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="policy-file">…or upload a .txt or .md file (up to 200 KB)</Label>
              <Input id="policy-file" type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <p className="text-xs text-zinc-500">The text is sent to the model provider through the configured gateway. Everything else stays on this machine.</p>
            <Button type="submit" disabled={busy !== null}>
              {busy === "new" ? "Scanning…" : "Scan and analyze"}
            </Button>
          </form>
          {created && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium">{created.name}</p>
              <QuarantineBanner
                findings={created.findings}
                onEdit={() => {
                  setEditing(created);
                  setEditText(created.text ?? "");
                }}
              />
            </div>
          )}
        </section>
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit and re-scan</DialogTitle>
            <DialogDescription>Remove the flagged lines, then re-scan. A policy that passes the scan goes straight to analysis.</DialogDescription>
          </DialogHeader>
          {editing && <QuarantineBanner findings={editing.findings} />}
          <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={14} className="font-mono text-xs" />
          <DialogFooter>
            <Button onClick={rescan} disabled={busy !== null}>
              {busy === editing?.id ? "Scanning…" : "Re-scan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
