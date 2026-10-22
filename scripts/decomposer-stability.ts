import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { decompose } from "../src/core/agents/decomposer";
import { loadEnv } from "../src/core/env";
import { alignRules, LabelsFile } from "../src/core/eval/classifierEval";
import type { Rule } from "../src/core/schemas/records";

// `npx tsx scripts/decomposer-stability.ts samples/harrow-vale.md [--n 5]`: how much the decomposition of one
// policy varies between fresh calls (gpt-6-luna takes no temperature). For each call: the rule count, which
// hand-labeled rules it found, and the extra rules it added. Found 2026-10-22: the 13-rule split seen in every
// earlier run was one answer replayed by the gateway's cache; two fresh runs gave 16 and 14.
// Writes docs/evidence/labels/decomposer-stability-<policy>.json.

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({ args: process.argv.slice(2), options: { n: { type: "string" } }, allowPositionals: true });
  loadEnv();
  const file = positionals[0];
  if (!file) {
    console.error("Usage: npx tsx scripts/decomposer-stability.ts samples/<policy>.md [--n 5]");
    return 1;
  }
  const key = path.basename(file).replace(/\.(md|txt)$/i, "");
  const policy = await readFile(file, "utf8");
  const labels = LabelsFile.parse(JSON.parse(await readFile(path.join("samples", `${key}.labels.json`), "utf8")));
  const n = Number(values.n ?? 5);
  const trials = [];
  for (let i = 0; i < n; i++) {
    const out = await decompose(policy, { runId: null });
    const rules = out.rules.map((r, j) => ({ id: `r${j + 1}`, quote: r.quote, span: r.span, confidence: null }) as unknown as Rule);
    const a = alignRules(policy, rules, labels.rules);
    trials.push({
      trial: i + 1,
      rules: out.rules.length,
      labeledFound: a.matches.length,
      labeledMissed: a.misses.map((m) => m.n),
      extras: a.extras.map((r) => r.quote),
      statements: out.rules.map((r) => r.statement),
    });
    console.log(`trial ${i + 1}: ${out.rules.length} rules, ${a.matches.length}/${labels.rules.length} labeled rules found, ${a.extras.length} extra`);
  }
  const counts = trials.map((t) => t.rules);
  const extraCounts = new Map<string, number>();
  for (const t of trials) for (const q of t.extras) extraCounts.set(q, (extraCounts.get(q) ?? 0) + 1);
  const result = {
    policy: key,
    measuredAt: new Date().toISOString(),
    trials: n,
    labeledRules: labels.rules.length,
    ruleCount: { min: Math.min(...counts), max: Math.max(...counts), each: counts },
    labeledFoundEach: trials.map((t) => t.labeledFound),
    extrasByFrequency: [...extraCounts.entries()].sort((a, b) => b[1] - a[1]).map(([quote, times]) => ({ quote, times })),
    trialDetail: trials,
  };
  const out = path.join("docs", "evidence", "labels", `decomposer-stability-${key}.json`);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Rule count ${result.ruleCount.min}–${result.ruleCount.max} over ${n} fresh calls; labeled rules found ${result.labeledFoundEach.join(", ")} of ${labels.rules.length}. Written to ${out}`);
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
