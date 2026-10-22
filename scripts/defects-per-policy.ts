import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "../src/core/env";
import { readOrComputeSummary } from "../src/core/pipeline/summary";
import { readRun } from "../src/core/store/runs";

// `npx tsx scripts/defects-per-policy.ts <runId> [<runId> …]`: M07. For each validation run (one per sample
// policy, live, every call fresh), the defects Tenet found: rules whose behavior departed from the policy
// (fail, partial), ambiguous rules, and collisions, with the counts the report's Impact section cites.
// Writes docs/evidence/runs/defects-per-policy.json.

async function main(): Promise<number> {
  loadEnv();
  const runIds = process.argv.slice(2);
  if (!runIds.length) {
    console.error("Usage: npx tsx scripts/defects-per-policy.ts <runId> [<runId> …]");
    return 1;
  }
  const policies = [];
  for (const runId of runIds) {
    const run = await readRun(runId);
    const s = await readOrComputeSummary(runId);
    const st = s.strip;
    const departures = s.rules
      .filter((c) => c.verdict === "fail" || c.verdict === "partial")
      .map((c) => ({ ruleId: c.ruleId, index: c.index, statement: c.statement, type: c.type, test: c.testKind, verdict: c.verdict, result: c.ladder?.caption ?? c.sweep?.caption ?? (c.paraphrase ? `consistency ${c.paraphrase.consistency?.toFixed(2) ?? "n/a"}` : null), evidence: c.headlineEvidence?.quote ?? null }));
    const observed = s.rules.filter((c) => c.verdict === "observed").map((c) => ({ ruleId: c.ruleId, statement: c.statement, result: c.sweep?.caption ?? null }));
    policies.push({
      policy: s.policyName,
      runId,
      status: run.status,
      kind: s.kind,
      rules: st.rulesTotal,
      rulesTested: st.rulesTested,
      rulesParked: st.rulesParked,
      scenarios: st.scenariosTotal,
      scenariosNotRun: st.scenariosNotRun,
      unverified: st.unverifiedCount,
      defects: {
        total: departures.length + s.defects.ambiguities.length + s.defects.collisions.length,
        failures: st.failures,
        partials: st.partials,
        ambiguities: s.defects.ambiguities.length,
        collisions: s.defects.collisions.length,
      },
      departures,
      ambiguities: s.defects.ambiguities.map((a) => ({ ruleId: a.ruleId, summary: a.summary })),
      collisions: s.defects.collisions.map((c) => ({ id: c.collisionId, rules: [c.ruleA, c.ruleB], honored: c.outcome?.honored ?? null, summary: c.summary })),
      observedTradeoffs: observed,
      usd: st.usd,
      calls: st.calls,
      wallSeconds: st.wallClockMs ? Math.round(st.wallClockMs / 1000) : null,
    });
  }
  const out = { generatedAt: new Date().toISOString(), source: "scripts/defects-per-policy.ts", note: "Validation runs: live gpt-6-luna as the agent under test with each policy as its system prompt; proposals accepted, low-confidence rules parked; every call a fresh answer.", policies };
  const file = path.join("docs", "evidence", "runs", "defects-per-policy.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(out, null, 2)}\n`);
  for (const p of policies) {
    console.log(`${p.policy} (${p.runId}, ${p.kind}): ${p.rulesTested}/${p.rules} rules tested, ${p.defects.total} defects (${p.defects.failures} failing, ${p.defects.partials} partial, ${p.defects.ambiguities} ambiguous, ${p.defects.collisions} collisions), ${p.scenarios} scenarios, $${p.usd.toFixed(4)}`);
  }
  console.log(`Written to ${file}`);
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
