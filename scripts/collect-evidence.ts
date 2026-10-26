import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCsv } from "../src/core/eval/spotcheck";
import { Summary } from "../src/core/schemas/summary";
import { readGlobalUsage } from "../src/core/store/usage";
import { loadEnv } from "../src/core/env";

// `npm run collect-evidence`: assembles docs/evidence/report-data.json from the evidence files
// (evidence-report-slides.md §1). Every value the report cites comes from here, with its source; a value
// whose evidence does not exist yet is listed under `missing` with the measurement it belongs to.

loadEnv();
const EV = path.join("docs", "evidence");
const values: Record<string, { value: string; source: string }> = {};
const missing: { key: string; measurement: string; why: string }[] = [];

const read = (file: string) => JSON.parse(readFileSync(path.join(EV, file), "utf8"));
const has = (file: string) => existsSync(path.join(EV, file));
const set = (key: string, value: string | number, source: string) => {
  values[key] = { value: String(value), source };
};
const need = (key: string, measurement: string, why: string) => missing.push({ key, measurement, why });
const pct = (x: number) => `${(100 * x).toFixed(1)} %`;
const usd = (x: number, digits = 4) => `$${x.toFixed(digits)}`;
const k = (n: number) => n.toLocaleString("en-US");
const mmss = (s: number, long = false) =>
  long ? `${Math.floor(s / 60)} min ${s % 60} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

type TenetRuleTiming = { ruleId: string; modelMs: number; byStageMs: { generator: number } };

// M13: reads the stopwatch table in hand-written.md (`| r2 | 5:36 |` rows and a `| Total | … |` row) and pairs
// each rule with Tenet's timing for it. Returns why it cannot, as a string, when the table is incomplete.
function handTiming(md: string, tenetRules: TenetRuleTiming[]) {
  const rows = [...md.matchAll(/^\|\s*(r\d+|Total)\s*\|\s*(\d+):(\d{2})\s*\|/gm)].map((m) => ({ id: m[1], s: 60 * Number(m[2]) + Number(m[3]) }));
  const byRule = rows.filter((r) => r.id !== "Total");
  const handS = byRule.reduce((s, r) => s + r.s, 0);
  const stated = rows.find((r) => r.id === "Total")?.s;
  if (!byRule.length) return "no per-rule stopwatch rows";
  if (stated !== undefined && stated !== handS) return `rows sum to ${mmss(handS)}, the Total row says ${mmss(stated)}`;
  const tenet = byRule.map((r) => tenetRules.find((x) => x.ruleId === r.id));
  const absent = byRule.filter((_, i) => !tenet[i]).map((r) => r.id);
  if (absent.length) return `no Tenet timing for ${absent.join(", ")}`;
  const found = tenet as TenetRuleTiming[];
  return {
    byRule,
    handS,
    modelS: found.reduce((s, x) => s + x.modelMs, 0) / 1000,
    generatorS: found.reduce((s, x) => s + x.byStageMs.generator, 0) / 1000,
  };
}

async function main() {
  // M01, M02: capabilities and prices
  if (has("model-capabilities.md")) set("M01.file", "docs/evidence/model-capabilities.md", "model-capabilities.md");
  else need("M01", "M01", "run npm run smoke");
  if (has("pricing.md")) {
    set("M02.input", "$0.10", "pricing.md");
    set("M02.cached", "$0.01", "pricing.md");
    set("M02.output", "$0.50", "pricing.md");
  } else need("M02", "M02", "confirm prices");

  // M03: classifier agreement, latest v2 file per policy
  const labelFiles = has("labels") ? readdirSync(path.join(EV, "labels")).filter((f) => f.startsWith("eval-") && f.endsWith(".json")) : [];
  const latest = new Map<string, { file: string; data: { evaluatedAt: string; policy: string; thresholds: { threshold: number; agree: number; total: number; agreement: number }[]; primaryThreshold: number; recall: number; precision: number } }>();
  for (const f of labelFiles) {
    const d = read(path.join("labels", f));
    const prev = latest.get(d.policy);
    if (!prev || d.evaluatedAt > prev.data.evaluatedAt) latest.set(d.policy, { file: f, data: d });
  }
  let agree = 0;
  let total = 0;
  for (const [policy, { file, data }] of latest) {
    const at = data.thresholds.find((t) => t.threshold === data.primaryThreshold)!;
    set(`M03.${policy}.agreement`, `${pct(at.agreement)} (${at.agree}/${at.total})`, `labels/${file}`);
    set(`M03.${policy}.recall`, pct(data.recall), `labels/${file}`);
    set(`M03.${policy}.precision`, pct(data.precision), `labels/${file}`);
    agree += at.agree;
    total += at.total;
  }
  if (total) set("M03.pooled", `${pct(agree / total)} (${agree}/${total})`, "labels/eval-*.json (latest per policy)");
  else need("M03", "M03", "run npm run eval:classifier");
  // Run-to-run variation: every classifier-v2 evaluation (v2 from 2026-10-21 20:00), grouped by day.
  const V2_SINCE = "2026-10-21T20:00";
  const rounds = new Map<string, { agree: number; total: number; policies: string[] }>();
  const perPolicy = new Map<string, number[]>();
  for (const f of labelFiles) {
    const d = read(path.join("labels", f));
    if (d.evaluatedAt < V2_SINCE) continue;
    const at = d.thresholds.find((t: { threshold: number }) => t.threshold === d.primaryThreshold);
    const day = d.evaluatedAt.slice(0, 10);
    const r = rounds.get(day) ?? { agree: 0, total: 0, policies: [] };
    r.agree += at.agree;
    r.total += at.total;
    r.policies.push(d.policy);
    rounds.set(day, r);
    perPolicy.set(d.policy, [...(perPolicy.get(d.policy) ?? []), at.agreement]);
  }
  if (rounds.size > 1) {
    set("M03.rounds", [...rounds.entries()].sort().map(([day, r]) => `${day}: ${pct(r.agree / r.total)} (${r.agree}/${r.total}, ${r.policies.length} policies)`).join("; "), "labels/eval-*.json (classifier v2)");
    set("M03.range", [...perPolicy.entries()].map(([p, xs]) => `${p} ${pct(Math.min(...xs))}–${pct(Math.max(...xs))}`).join("; "), "labels/eval-*.json (classifier v2)");
  }
  set("M04", "not obtained (no second labeler; decision record 2026-10-21-no-second-labeler)", "docs/decisions/2026-10-21-no-second-labeler.md");

  // M05: spot check
  const spot = has("spotcheck") ? readdirSync(path.join(EV, "spotcheck")).filter((f) => /^agreement-[A-Za-z0-9]+\.json$/.test(f)) : [];
  if (spot.length) {
    const a = read(path.join("spotcheck", spot.sort().at(-1)!));
    set("M05.exact", `${pct(a.exact.rate)} (${a.exact.agree}/${a.exact.total})`, `spotcheck/${spot.at(-1)}`);
    set("M05.problem", pct(a.problem.rate), `spotcheck/${spot.at(-1)}`);
  } else need("M05", "M05", "Shane scores the 50-transcript spot check");
  // M05 was scored by an independent model reviewer (decision record 2026-10-26-model-reviewer-spotcheck). The rows
  // Shane scored by hand first calibrate it: Shane vs the judge, and Shane vs the reviewer, on the same rows.
  const spotFiles = has("spotcheck") ? readdirSync(path.join(EV, "spotcheck")) : [];
  const humanJudge = spotFiles.find((f) => /^agreement-[A-Za-z0-9]+-shane-partial\.json$/.test(f));
  const humanReviewer = spotFiles.find((f) => /^agreement-[A-Za-z0-9]+-reviewer-verdicts\.json$/.test(f));
  if (humanJudge && humanReviewer) {
    const hj = read(path.join("spotcheck", humanJudge));
    const hr = read(path.join("spotcheck", humanReviewer));
    set("M05.humanRows", hj.exact.total, `spotcheck/${humanJudge}`);
    set("M05.humanJudge", `${hj.exact.agree}/${hj.exact.total}`, `spotcheck/${humanJudge}`);
    set("M05.humanReviewer", `${hr.exact.agree}/${hr.exact.total}`, `spotcheck/${humanReviewer}`);
  } else need("M05.human", "M05", "score Shane's partial CSV against the judge and against the reviewer");
  // How many sampled ladders the judge marked violated: high agreement on a sample of mostly passes says little.
  const blankCsv = spotFiles.find((f) => /^[A-Za-z0-9]+-blank\.csv$/.test(f));
  const sampleRun = blankCsv?.replace(/-blank\.csv$/, "");
  if (blankCsv && sampleRun && has(path.join("runs", sampleRun, "verdicts.json"))) {
    const ids = new Set(parseCsv(readFileSync(path.join(EV, "spotcheck", blankCsv), "utf8")).map((r) => r.scenarioId));
    const judged: { scenarioId: string; rubric: string; verdict: string }[] = read(path.join("runs", sampleRun, "verdicts.json"));
    const ladders = judged.filter((v) => ids.has(v.scenarioId) && v.rubric === "ladder");
    set("M05.judgeViolated", `${ladders.filter((v) => v.verdict === "violated").length} of ${ladders.length}`, `runs/${sampleRun}/verdicts.json, rows of spotcheck/${blankCsv}`);
  }
  // M19: the cheaper judge's verdicts scored against the same spot-check verdicts, beside both judges' cost.
  const cheap = spotFiles.find((f) => /^agreement-[A-Za-z0-9]+-verdicts-effort-[a-z]+\.json$/.test(f));
  const cheapCost = has("tokenomics") ? readdirSync(path.join(EV, "tokenomics")).find((f) => /^rejudge-[A-Za-z0-9]+-none\.json$/.test(f)) : undefined;
  if (cheap && cheapCost) {
    const c = read(path.join("spotcheck", cheap));
    const cost = read(path.join("tokenomics", cheapCost)).cost;
    set("M19.agreement", `${pct(c.exact.rate)} (${c.exact.agree}/${c.exact.total})`, `spotcheck/${cheap}`);
    set("M19.cost", `${usd(cost.cheaper.usd)} against ${usd(cost.defaultJudge.usd)} for the default judge`, `tokenomics/${cheapCost}`);
  } else need("M19.agreement", "M19", "tenet spotcheck score … --verdicts verdicts-effort-none.json");

  // M06, M08, M09, M12, M14, M15: the demo run
  const example = has("runs/example.json") ? read("runs/example.json") : null;
  if (example) {
    const s = Summary.parse(read(path.join("runs", example.runId, "summary.json")));
    const st = s.strip;
    set("M06.runId", s.runId, `runs/${s.runId}/summary.json`);
    set("M08.calls", k(st.calls), `runs/${s.runId}/summary.json`);
    set("M08.inputTokens", k(st.inputTokens), `runs/${s.runId}/summary.json`);
    set("M08.cachedTokens", k(st.cachedTokens ?? 0), `runs/${s.runId}/summary.json`);
    set("M08.outputTokens", k(st.outputTokens), `runs/${s.runId}/summary.json`);
    set("M08.reasoningTokens", k(st.reasoningTokens ?? 0), `runs/${s.runId}/summary.json`);
    set("M08.usd", usd(st.usd), `runs/${s.runId}/summary.json`);
    set("M08.testUsd", usd(st.testUsd), `runs/${s.runId}/summary.json`);
    set("M08.analysisUsd", usd(st.analysisUsd), `runs/${s.runId}/summary.json`);
    set("M08.wallSeconds", ((st.wallClockMs ?? 0) / 1000).toFixed(0), `runs/${s.runId}/summary.json`);
    set("M09.cachedShare", pct((st.cachedTokens ?? 0) / Math.max(1, st.inputTokens)), `runs/${s.runId}/summary.json`);
    // Cost had nothing been cached: every cached token billed at the full input price.
    const uncachedUsd = st.usd + ((st.cachedTokens ?? 0) * (0.1 - 0.01)) / 1e6;
    set("M09.usdWithoutCaching", usd(uncachedUsd), "computed from M08 and M02");
    set("M09.saving", pct(1 - st.usd / uncachedUsd), "computed from M08 and M02");
    const perUserMonth = st.usd * 4 * 3; // assumption: 4 policies × 3 runs per user per month (PRD)
    set("M12.perUserMonth", usd(perUserMonth, 2), "M08 × 4 policies × 3 runs (stated assumption)");
    set("M12.users100", usd(perUserMonth * 100, 2), "M12.perUserMonth × 100");
    set("M12.users10000", usd(perUserMonth * 10_000, 0), "M12.perUserMonth × 10,000");
    set("M15.unverified", st.unverifiedCount, `runs/${s.runId}/summary.json`);
    set("M15.notRun", st.scenariosNotRun, `runs/${s.runId}/summary.json`);
    if (s.planted) {
      const found = s.planted.filter((p) => p.found === true).length;
      set("M14.found", `${found} of ${s.planted.length}`, `runs/${s.runId}/summary.json`);
      for (const [i, p] of s.planted.entries()) set(`M14.item${i + 1}`, `${p.item}: ${p.found === true ? "found" : p.found === false ? "not found" : "n/a"} (${p.detail})`, `runs/${s.runId}/summary.json`);
    }
  } else need("M06", "M06", "archive the demo run (docs/evidence/runs/example.json)");

  // M07: defects per policy (validation runs)
  if (has("runs/defects-per-policy.json")) {
    type P = { policy: string; runId: string; kind: string; rules: number; rulesTested: number; defects: { total: number; failures: number; partials: number; ambiguities: number; collisions: number }; usd: number };
    const d = read("runs/defects-per-policy.json") as { policies: P[] };
    const src = "runs/defects-per-policy.json";
    for (const p of d.policies) {
      set(
        `M07.${p.runId}`,
        p.kind === "no_testable_rules"
          ? `${p.policy}: no testable rules (run ${p.runId})`
          : `${p.policy}: ${p.defects.total} defects in ${p.rules} rules (${p.defects.failures} failing, ${p.defects.partials} partial, ${p.defects.ambiguities} ambiguous, ${p.defects.collisions} collisions; ${p.rulesTested} rules tested, ${usd(p.usd)}, run ${p.runId})`,
        src,
      );
    }
    const tested = d.policies.filter((p) => p.kind !== "no_testable_rules");
    set("M07.summary", `${tested.reduce((n, p) => n + p.defects.total, 0)} defects across ${tested.length} policies; every policy had at least ${Math.min(...tested.map((p) => p.defects.total))}`, src);
  } else need("M07", "M07", "validation runs on every sample (npx tsx scripts/defects-per-policy.ts <runId> …)");
  // M10, M11, M19: cost experiments
  const tok = has("tokenomics") ? readdirSync(path.join(EV, "tokenomics")) : [];
  const batch = tok.filter((f) => f.startsWith("classifier-batch-"));
  if (batch.length) {
    let a = 0;
    let b = 0;
    let n = 0;
    let costA = 0;
    let costB = 0;
    for (const f of batch) {
      const d = read(path.join("tokenomics", f));
      a += d.perRule.agreement.agree;
      b += d.batched.agreement.agree;
      n += d.perRule.agreement.total;
      costA += d.perRule.usd;
      costB += d.batched.usd;
    }
    set("M11.perRule", `${pct(a / n)} agreement, ${usd(costA)} over ${batch.length} policies`, "tokenomics/classifier-batch-*.json");
    if (example) {
      const s = Summary.parse(read(path.join("runs", example.runId, "summary.json")));
      const classifier = s.usageByStage.find((u) => u.stage === "classifier")?.usd ?? 0;
      const share = s.strip.usd > 0 ? classifier / s.strip.usd : 0;
      const halved = costA > 0 ? 1 - costB / costA : 0;
      set("M11.classifierShare", pct(share), `runs/${s.runId}/summary.json`);
      set("M11.auditSaving", pct(share * halved), "M11.classifierShare × the batched saving on classifier cost");
    }
    set("M11.batched", `${pct(b / n)} agreement, ${usd(costB)} over ${batch.length} policies`, "tokenomics/classifier-batch-*.json");
  } else need("M11", "M11", "eval:classifier --batched");
  if (has("tokenomics/rungs.json")) {
    const r = read("tokenomics/rungs.json");
    const src = "tokenomics/rungs.json";
    set("M10.perLadder", `${usd(r.ladderUsdPerRule.fourRungs, 5)} per ladder rule with 4 rungs vs ${usd(r.ladderUsdPerRule.sixRungs, 5)} with 6 (${pct(r.ladderCostSavingPerRule)} saved per ladder; runs ${r.fourRungs.runId} and ${r.sixRungs.runId})`, src);
    set("M10.findings", `${r.departuresCaughtByFourRungs} ladder departures seen with 6 rungs would also be caught with 4 (tactics kept: ${r.fourRungTactics.join(", ")})`, src);
  } else need("M10", "M10", "4-rung vs 6-rung runs (npx tsx scripts/rungs-experiment.ts)");
  // rejudge at the default effort ("low") on the same transcripts is the judge's test–retest; any other effort is M19.
  const rejudge = tok.filter((f) => f.startsWith("rejudge-") && !f.endsWith("-low.json"));
  if (rejudge.length) set("M19.file", `tokenomics/${rejudge.at(-1)}`, `tokenomics/${rejudge.at(-1)}`);
  else need("M19", "M19", "tenet rejudge --effort none after the spot check (Saturday)");
  const retest = tok.filter((f) => f.startsWith("rejudge-") && f.endsWith("-low.json"));
  if (retest.length) {
    let same = 0;
    let total = 0;
    for (const f of retest) {
      const d = read(path.join("tokenomics", f));
      same += d.agreementWithDefaultJudge.same;
      total += d.agreementWithDefaultJudge.total;
    }
    set("judge.retest", `${pct(same / total)} (${same}/${total}) over ${retest.length} runs, fresh calls`, "tokenomics/rejudge-*-low.json");
  }

  // M13: Shane's stopwatch time for hand-writing three rules' tests (timing/hand-written.md) against Tenet's
  // model time for the same rules. The Tenet file is the run hand-written.md names, else the latest.
  const handMd = has("timing/hand-written.md") ? readFileSync(path.join(EV, "timing", "hand-written.md"), "utf8") : null;
  const timing = has("timing") ? readdirSync(path.join(EV, "timing")).filter((f) => /^tenet-.*\.json$/.test(f)).sort() : [];
  const namedRun = handMd?.match(/^Compared run: ([A-Za-z0-9]+)/m)?.[1];
  const tenetName = namedRun ? `tenet-${namedRun}.json` : timing.at(-1);
  if (tenetName && timing.includes(tenetName)) {
    const t = read(path.join("timing", tenetName));
    set("M13.tenet", `${(t.totals.modelMs / 1000).toFixed(0)} s of model time for the three rules; they run in parallel, and the slowest took ${(t.totals.wallMsMax / 1000).toFixed(0)} s from first call to last (run ${t.runId})`, `timing/${tenetName}`);
    if (handMd) {
      const m13 = handTiming(handMd, t.rules);
      if (typeof m13 === "string") need("M13", "M13", `timing/hand-written.md: ${m13}`);
      else {
        const src = `timing/hand-written.md, timing/${tenetName}`;
        set("M13.handTotal", mmss(m13.handS, true), "timing/hand-written.md");
        set("M13.handByRule", m13.byRule.map((r) => `${r.id} ${mmss(r.s)}`).join(", "), "timing/hand-written.md");
        set("M13.generator", `${m13.generatorS.toFixed(0)} s`, `timing/${tenetName}`);
        set("M13.ratio", `${Math.round(m13.handS / m13.modelS)}×`, src);
        set("M13.ratioGenerator", `${Math.round(m13.handS / m13.generatorS)}×`, src);
      }
    }
  } else if (handMd) need("M13", "M13", `no Tenet timing file ${tenetName ?? "timing/tenet-*.json"}; run tenet timing`);
  if (!handMd) need("M13", "M13", "Shane's hand-written timing exercise (sample-policies §8)");
  if (has("safety/canary.json")) {
    const c = read("safety/canary.json");
    set("M16.passed", `${c.results.filter((r: { passed: boolean }) => r.passed).length} of ${c.results.length}`, "safety/canary.json");
  } else need("M16", "M16", "tenet canary");
  if (!has("dry-run.md")) need("M17", "M17", "fresh-clone dry run (Sunday)");
  if (!has("user/quote.md")) need("M18", "M18", "policy-owner session");
  if (has("runs/hw5-ground-truth.json")) {
    type GtRule = { policyRule: number | null; ruleId: string; tenetVerdict: string; outcome: string; enforcedBy: string; scenariosRun: number; scenariosWithToolRefusal: number };
    const gt = read("runs/hw5-ground-truth.json") as { runs: { runId: string; agent: string; scenarios: number; scenariosNotRun: number; usd: number; agentUsd: number; wallSeconds: number | null; agentModelCallsPerScenario?: { median: number | null; max: number | null }; rules: GtRule[] }[] };
    for (const r of gt.runs) {
      const src = "runs/hw5-ground-truth.json";
      const failing = r.rules.filter((x) => x.tenetVerdict === "fail" || x.tenetVerdict === "partial");
      const calls = r.agentModelCallsPerScenario;
      if (calls?.median != null) set(`M20.${r.agent}.${r.runId}.agentCalls`, `a median of ${calls.median} model calls per scenario (up to ${calls.max})`, src);
      set(`M20.${r.agent}.${r.runId}.run`, `${r.runId}: ${r.rules.length} ${r.rules.length === 1 ? "rule" : "rules"}, ${r.scenarios} scenarios (${r.scenariosNotRun} not run), ${usd(r.usd)} of which the agent ${usd(r.agentUsd)}${r.wallSeconds ? `, ${Math.round(r.wallSeconds / 60)} min` : ""}`, src);
      set(`M20.${r.agent}.${r.runId}.departures`, failing.length ? failing.map((x) => `rule ${x.policyRule ?? "?"} (${x.tenetVerdict}; ${x.enforcedBy}): ${x.outcome}`).join(" · ") : "none", src);
      for (const x of r.rules) set(`M20.${r.agent}.${r.runId}.rule${x.policyRule ?? "x"}.${x.ruleId}`, `${x.tenetVerdict}: ${x.outcome}; tool refusals in ${x.scenariosWithToolRefusal} of ${x.scenariosRun} scenarios; enforced by ${x.enforcedBy}`, src);
    }
  } else need("M20", "M20", "HW5 runs (npx tsx scripts/hw5-ground-truth.ts <runId> …)");

  // M21: cumulative spend on the key
  const global = await readGlobalUsage();
  const billed = global.filter((e) => e.provider === "portkey" || e.provider === "openai" || e.reportedByTarget);
  set("M21.usd", usd(billed.reduce((s, e) => s + e.usd, 0), 2), "data/usage-global.jsonl (snapshot: tokenomics/usage-global-*.jsonl)");
  set("M21.calls", k(billed.length), "data/usage-global.jsonl");

  const out = { generatedAt: new Date().toISOString(), values, missing };
  await mkdir(EV, { recursive: true });
  await writeFile(path.join(EV, "report-data.json"), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`report-data.json: ${Object.keys(values).length} values; missing ${missing.map((m) => m.measurement).join(", ") || "nothing"}.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
