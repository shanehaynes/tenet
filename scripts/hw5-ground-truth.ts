import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "../src/core/env";
import { evaluateClassifier, LabelsFile } from "../src/core/eval/classifierEval";
import { readRunView } from "../src/core/pipeline/status";
import { readAllTranscripts, readOrComputeSummary } from "../src/core/pipeline/summary";
import type { Transcript } from "../src/core/schemas/records";
import type { RuleCard } from "../src/core/schemas/summary";
import { readPolicy } from "../src/core/store/policies";
import { readRunFile } from "../src/core/store/runs";
import { normalize } from "../src/core/text";

// `npx tsx scripts/hw5-ground-truth.ts <runId> [<runId> …]`: M20. For each HW5 run against a live agent,
// every tested rule beside its known enforcement (sample-policies.md §10.1, "Enforced by"), Tenet's verdict,
// where it bent or folded, and whether the agent's own tools refused the act on every scenario (a tool result
// with ok: false). Writes docs/evidence/runs/hw5-ground-truth.json.

/** Policy rule number (samples/campus-customs-hw5.labels.json) → how HW5 enforces it, from sample-policies §10.1. */
const ENFORCED_BY: Record<number, string> = {
  1: "prompt only",
  2: "prompt only",
  3: "prompt only (the ship refusal itself is a tool)",
  4: "tools (no payment tool exists for agents; decide_approval is human-only)",
  5: "tool refusal + prompt (the workaround clause)",
  6: "structural (no send tool)",
  7: "prompt only",
  8: "prompt only",
  9: "prompt (approvals themselves are human-only)",
  10: "prompt only",
  11: "prompt only",
  12: "prompt only",
  13: "prompt only",
  14: "prompt only",
  15: "prompt only",
  16: "tools for approving and paying; prompt for describing a requested payment as paid",
  17: "prompt only",
};

type Act = { name: string; refused: boolean; error: string | null };

function actsOf(t: Transcript | undefined): Act[] {
  return (t?.actions ?? []).map((a) => {
    const r = a.result as { ok?: unknown; error?: unknown } | null;
    const refused = !!r && typeof r === "object" && r.ok === false;
    return { name: a.name, refused, error: refused && typeof r?.error === "string" ? r.error : null };
  });
}

function outcome(card: RuleCard): string {
  if (card.ladder) return card.ladder.caption;
  if (card.sweep) return card.sweep.caption;
  if (card.paraphrase) return `consistency ${card.paraphrase.consistency?.toFixed(2) ?? "n/a"}, modal trait score ${card.paraphrase.modalScore ?? "n/a"} of 2`;
  if (card.conflicts) return card.conflicts.map((c) => `${c.label ?? c.scenarioId}: ${c.honored ?? "not run"}`).join("; ");
  return card.verdict;
}

async function main(): Promise<number> {
  loadEnv();
  const runIds = process.argv.slice(2);
  if (!runIds.length) {
    console.error("Usage: npx tsx scripts/hw5-ground-truth.ts <runId> [<runId> …]");
    return 1;
  }
  const labels = LabelsFile.parse(JSON.parse(await readFile(path.join("samples", "campus-customs-hw5.labels.json"), "utf8")));
  const runs = [];
  for (const runId of runIds) {
    const view = await readRunView(runId);
    const target = view.run.config.target;
    if (target.kind !== "http") {
      console.error(`Run ${runId} did not test an HTTP agent.`);
      return 1;
    }
    const policy = await readPolicy(view.run.policyId);
    if (!policy) throw new Error(`Policy for ${runId} not found`);
    // Align the run's rules with the numbered rules of the policy, as the classifier evaluation does.
    const aligned = evaluateClassifier(policy.text, view.rules, labels, { primaryThreshold: view.run.config.ambiguityThreshold });
    const numberOf = new Map(aligned.rules.filter((r) => r.ruleId).map((r) => [r.ruleId!, r.n]));
    // A numbered rule of two sentences can be split into two rules; the alignment keeps one, so place the other
    // by which numbered rule's text contains it.
    for (const r of view.rules) {
      if (numberOf.has(r.id)) continue;
      const host = labels.rules.find((l) => normalize(l.quote).includes(normalize(r.quote)));
      if (host) numberOf.set(r.id, host.n);
    }
    const summary = await readOrComputeSummary(runId);
    const transcripts = await readAllTranscripts(runId);
    const scenarios = await readRunFile(runId, "scenarios");
    const scenarioIdsOf = (card: RuleCard) => scenarios.filter((s) => s.ruleId === card.ruleId).map((s) => s.id);

    const rules = summary.rules
      .filter((c) => !c.parked)
      .map((card) => {
        const n = numberOf.get(card.ruleId) ?? null;
        const ran = scenarioIdsOf(card).filter((id) => transcripts[id]);
        const perScenario = ran.map((id) => ({ scenarioId: id, actions: actsOf(transcripts[id]) }));
        const withRefusal = perScenario.filter((p) => p.actions.some((a) => a.refused)).length;
        return {
          policyRule: n,
          ruleId: card.ruleId,
          statement: card.statement,
          type: card.type,
          test: card.testKind,
          enforcedBy: n ? ENFORCED_BY[n] : "not one of the numbered rules",
          tenetVerdict: card.verdict,
          outcome: outcome(card),
          bentAt: card.ladder?.bentAt ?? null,
          foldedAt: card.ladder?.foldedAt ?? null,
          scenariosRun: ran.length,
          scenariosWithToolRefusal: withRefusal,
          everyScenarioRefusedByTool: ran.length > 0 && withRefusal === ran.length,
          toolsUsed: [...new Set(perScenario.flatMap((p) => p.actions.map((a) => a.name)))].sort(),
          headlineEvidence: card.headlineEvidence?.quote ?? null,
        };
      });
    const st = summary.strip;
    runs.push({
      runId,
      agent: target.agent,
      target: target.name,
      rungs: view.run.config.rungs,
      scenarios: st.scenariosTotal,
      scenariosNotRun: st.scenariosNotRun,
      unverified: st.unverifiedCount,
      usd: st.usd,
      testUsd: st.testUsd,
      agentUsd: summary.usageByStage.find((u) => u.stage === "target")?.usd ?? 0,
      wallSeconds: st.wallClockMs ? Math.round(st.wallClockMs / 1000) : null,
      rules,
      collisions: summary.defects.collisions.map((c) => ({ id: c.collisionId, rules: [c.ruleA, c.ruleB], honored: c.outcome?.honored ?? null, summary: c.summary })),
    });
  }
  const out = { generatedAt: new Date().toISOString(), source: "scripts/hw5-ground-truth.ts", enforcedBySource: "docs/plan/sample-policies.md §10.1", runs };
  const file = path.join("docs", "evidence", "runs", "hw5-ground-truth.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(out, null, 2)}\n`);
  for (const r of runs) {
    console.log(`\n${r.agent} (run ${r.runId}): ${r.scenarios} scenarios, ${r.scenariosNotRun} not run, $${r.usd.toFixed(4)} (agent $${r.agentUsd.toFixed(4)})`);
    for (const x of r.rules) {
      console.log(`  #${x.policyRule ?? "?"} ${x.ruleId} ${x.tenetVerdict.padEnd(8)} ${x.outcome} · tool refusals ${x.scenariosWithToolRefusal}/${x.scenariosRun} · enforced by: ${x.enforcedBy}`);
    }
  }
  console.log(`\nWritten to ${file}`);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
