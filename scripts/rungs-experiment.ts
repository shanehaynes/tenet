import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { ladderTactics } from "../src/core/agents/generators/ladder";
import { loadEnv } from "../src/core/env";
import { alignRules, LabelsFile } from "../src/core/eval/classifierEval";
import { readOrComputeSummary } from "../src/core/pipeline/summary";
import { readPolicy } from "../src/core/store/policies";
import { readRun, readRunFile } from "../src/core/store/runs";
import { readRunUsage } from "../src/core/store/usage";

// `npx tsx scripts/rungs-experiment.ts <run with --rungs 4> <run with --rungs 6> [--also <6-rung runId> …]`: M10,
// cost-cutting experiment A. Cost: two fresh runs of the same policy, ladder cost per ladder rule (the runs
// decompose separately, so they can have different numbers of ladders). Findings: every 6-rung ladder that bent
// or folded in the given runs, and whether one of the four tactics a 4-rung ladder keeps would have caught it.
// Writes docs/evidence/tokenomics/rungs.json.

const LADDER_SCENARIO = /-L\d+$/;

async function side(runId: string, labels: LabelsFile) {
  const run = await readRun(runId);
  const policy = await readPolicy(run.policyId);
  if (!policy) throw new Error(`policy for ${runId} not found`);
  const [summary, rules, usage] = await Promise.all([readOrComputeSummary(runId), readRunFile(runId, "rules"), readRunUsage(runId)]);
  const ladderRules = new Set(summary.rules.filter((c) => c.testKind === "ladder" && !c.parked).map((c) => c.ruleId));
  const ladderEvents = usage.filter((e) => (e.scenarioId && LADDER_SCENARIO.test(e.scenarioId)) || (e.stage === "generator" && e.ruleId && ladderRules.has(e.ruleId)));
  const byLabel = new Map(alignRules(policy.text, rules, labels.rules).matches.map((m) => [m.rule.id, m.labeled.n]));
  const ladders = summary.rules
    .filter((c) => c.ladder && !c.parked)
    .map((c) => ({
      policyRule: byLabel.get(c.ruleId) ?? null,
      ruleId: c.ruleId,
      statement: c.statement,
      verdict: c.verdict,
      caption: c.ladder!.caption,
      rungs: c.ladder!.rungs.map((r) => ({ tactic: r.tactic, verdict: r.verdict })),
    }));
  return {
    runId,
    rungs: run.config.rungs,
    ladderRules: ladders.length,
    ladderScenarios: new Set(ladderEvents.filter((e) => e.scenarioId).map((e) => e.scenarioId)).size,
    ladderCalls: ladderEvents.length,
    ladderUsd: ladderEvents.reduce((s, e) => s + e.usd, 0),
    ladderInputTokens: ladderEvents.reduce((s, e) => s + e.inputTokens, 0),
    ladderOutputTokens: ladderEvents.reduce((s, e) => s + e.outputTokens, 0),
    runUsd: summary.strip.usd,
    runCalls: summary.strip.calls,
    wallSeconds: summary.strip.wallClockMs ? Math.round(summary.strip.wallClockMs / 1000) : null,
    ladders,
  };
}

async function main(): Promise<number> {
  loadEnv();
  const { values, positionals } = parseArgs({ args: process.argv.slice(2), options: { also: { type: "string", multiple: true } }, allowPositionals: true });
  const [four, six] = positionals;
  if (!four || !six) {
    console.error("Usage: npx tsx scripts/rungs-experiment.ts <runId with 4 rungs> <runId with 6 rungs>");
    return 1;
  }
  const policyOf = async (id: string) => (await readPolicy((await readRun(id)).policyId))?.sample?.key;
  const key = await policyOf(four);
  if (!key || key !== (await policyOf(six))) throw new Error("both runs must be of the same sample policy");
  const labels = LabelsFile.parse(JSON.parse(await readFile(path.join("samples", `${key}.labels.json`), "utf8")));
  const a = await side(four, labels);
  const b = await side(six, labels);
  if (a.rungs !== 4 || b.rungs !== 6) throw new Error(`expected a 4-rung and a 6-rung run, got ${a.rungs} and ${b.rungs}`);
  // A finding is a ladder that bent or folded. With four rungs the urgent and incentive rungs are not asked.
  const departed = (v: string) => v === "fail" || v === "partial";
  const rulesBoth = [...new Set([...a.ladders, ...b.ladders].map((l) => l.policyRule).filter((n): n is number => n !== null))].sort((x, y) => x - y);
  const comparison = rulesBoth.map((n) => {
    const l4 = a.ladders.find((l) => l.policyRule === n) ?? null;
    const l6 = b.ladders.find((l) => l.policyRule === n) ?? null;
    return {
      policyRule: n,
      statement: (l6 ?? l4)!.statement,
      fourRungs: l4 ? `${l4.verdict}: ${l4.caption}` : "not a ladder in this run",
      sixRungs: l6 ? `${l6.verdict}: ${l6.caption}` : "not a ladder in this run",
      findingKept: l4 && l6 ? (departed(l6.verdict) ? departed(l4.verdict) : null) : null,
    };
  });
  // Would four rungs have caught each 6-rung departure? Kept if any departing rung used a tactic the 4-rung set keeps.
  const kept4 = new Set<string>(ladderTactics(4));
  const departures = [];
  for (const runId of [six, ...(values.also ?? [])]) {
    const s = await readOrComputeSummary(runId);
    const run = await readRun(runId);
    if (run.config.rungs !== 6) continue;
    for (const c of s.rules.filter((r) => r.ladder && (r.verdict === "fail" || r.verdict === "partial"))) {
      const bad = c.ladder!.rungs.filter((r) => r.verdict === "violated" || r.verdict === "partial").map((r) => r.tactic);
      departures.push({ runId, policy: s.policyName, ruleId: c.ruleId, statement: c.statement, departingTactics: bad, caughtByFourRungs: bad.some((t) => kept4.has(t)) });
    }
  }
  const perLadder = (x: { ladderUsd: number; ladderRules: number }) => (x.ladderRules ? x.ladderUsd / x.ladderRules : 0);
  const result = {
    policy: key,
    measuredAt: new Date().toISOString(),
    fourRungs: a,
    sixRungs: b,
    ladderUsdPerRule: { fourRungs: perLadder(a), sixRungs: perLadder(b) },
    ladderCostSavingPerRule: perLadder(b) > 0 ? 1 - perLadder(a) / perLadder(b) : null,
    fourRungTactics: [...kept4],
    departuresAtSixRungs: departures,
    departuresCaughtByFourRungs: `${departures.filter((d) => d.caughtByFourRungs).length} of ${departures.length}`,
    comparison,
    caveat: "Separate runs: each decomposes, generates and is judged afresh, so differences in outcome mix the rung count with run-to-run variation (judge test-retest 92.4 % on the HW5 runs).",
  };
  const out = path.join("docs", "evidence", "tokenomics", "rungs.json");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Ladder cost per ladder rule: 4 rungs $${perLadder(a).toFixed(5)} (${a.ladderRules} ladders, ${a.ladderScenarios} scenarios) vs 6 rungs $${perLadder(b).toFixed(5)} (${b.ladderRules} ladders, ${b.ladderScenarios}); saving ${((result.ladderCostSavingPerRule ?? 0) * 100).toFixed(1)} % per ladder.`);
  console.log(`6-rung departures caught by the 4-rung tactics: ${result.departuresCaughtByFourRungs}`);
  for (const d of departures) console.log(`  ${d.policy} ${d.ruleId}: departed at ${d.departingTactics.join(", ")} → ${d.caughtByFourRungs ? "kept" : "lost"}`);
  for (const c of comparison) console.log(`  rule ${c.policyRule}: 4 → ${c.fourRungs} | 6 → ${c.sixRungs}`);
  console.log(`Written to ${out}`);
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
