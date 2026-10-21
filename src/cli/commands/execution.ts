import { readFile } from "node:fs/promises";
import path from "node:path";
import { confirmRun, RunStateError, startAnalysis } from "../../core/pipeline/analysis";
import { startExecution } from "../../core/pipeline/execution";
import { waitForJob } from "../../core/pipeline/jobs";
import { policyForFile } from "../../core/pipeline/policies";
import { applyRuleOps, type RuleOp } from "../../core/pipeline/review";
import { readRunView } from "../../core/pipeline/status";
import { readOrComputeSummary } from "../../core/pipeline/summary";
import { effectiveType } from "../../core/schemas/records";
import type { Summary } from "../../core/schemas/summary";
import { keySpend } from "../../core/store/usage";
import { money, table, truncate } from "../format";
import type { Command, CommandContext } from "../types";
import { printRun } from "./analysis";

function num(v: unknown): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function list(value: unknown): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}

export function printSummary(s: Summary, out: CommandContext["out"]): void {
  const st = s.strip;
  out(
    `\n${s.policyName}: ${st.rulesTested} of ${st.rulesTotal} rules tested · ${st.failures} failing · ${st.partials} partial · ${st.ambiguities} ambiguous · ${st.collisions} collisions${s.partial ? " (in progress)" : ""}`,
  );
  out(
    table(
      ["#", "type", "test", "verdict", "result", "rule"],
      s.rules.map((c) => [
        c.index,
        c.type ?? "—",
        c.testKind ?? "—",
        c.verdict,
        c.ladder?.caption ?? c.sweep?.caption ?? (c.paraphrase ? `consistency ${c.paraphrase.consistency?.toFixed(2) ?? "—"}` : ""),
        truncate(c.statement, 50),
      ]),
    ),
  );
  for (const c of s.rules.filter((r) => r.conflicts)) {
    out(`  rule ${c.index} conflicts: ${c.conflicts!.map((x) => `${x.label}: ${x.honored ?? "—"}`).join("; ")}`);
  }
  for (const c of s.defects.collisions) out(`Collision ${c.collisionId} (${c.ruleA} vs ${c.ruleB}): ${c.outcome?.honored ?? "not run"} — ${truncate(c.summary, 140)}`);
  for (const a of s.defects.ambiguities) out(`Ambiguous ${a.ruleId}: ${truncate(a.summary, 140)}`);
  if (s.planted) {
    out("\nPlanted findings:");
    for (const p of s.planted) out(`  ${p.found === true ? "found" : p.found === false ? "NOT found" : "n/a"}  ${p.item} — ${truncate(p.detail, 90)}`);
  }
  out(
    `\nScenarios ${st.scenariosTotal} (${st.scenariosNotRun} not run, ${st.unverifiedCount} unverified, ${st.truncatedCount} truncated) · calls ${st.calls} · tokens in ${st.inputTokens} (cached ${st.cachedTokens ?? "n/a"}) out ${st.outputTokens} (reasoning ${st.reasoningTokens ?? "n/a"}) · ${money(st.usd)} (analysis ${money(st.analysisUsd)}, tests ${money(st.testUsd)})${st.wallClockMs ? ` · ${(st.wallClockMs / 1000).toFixed(0)} s` : ""}`,
  );
}

const EXEC_OPTIONS = {
  cap: { type: "string" },
  concurrency: { type: "string" },
  rungs: { type: "string" },
  dismiss: { type: "string", multiple: true },
} as const;

export const executeCommand: Command = {
  name: "execute",
  summary: "Generate, run and judge the tests for a confirmed run",
  usage: "tenet execute <runId> [--cap 0.01] [--concurrency 4] [--rungs 6] [--dismiss c1]",
  options: EXEC_OPTIONS,
  async run({ values, positionals, out, err }) {
    const runId = positionals[0];
    if (!runId) {
      err("Give a run id.");
      return 1;
    }
    try {
      await startExecution(runId, { spendCapUsd: num(values.cap), concurrency: num(values.concurrency), rungs: num(values.rungs), dismiss: list(values.dismiss) });
    } catch (e) {
      if (e instanceof RunStateError) {
        err(e.message);
        return 1;
      }
      throw e;
    }
    out(`Running tests for ${runId} …`);
    await waitForJob(runId);
    const view = await readRunView(runId);
    out(`Status: ${view.run.status}${view.run.statusReason ? ` — ${view.run.statusReason}` : ""}`);
    printSummary(await readOrComputeSummary(runId), out);
    return view.run.status === "complete" || view.run.status === "halted" ? 0 : 1;
  },
};

export const runCommand: Command = {
  name: "run",
  summary: "Analyze → accept proposals → confirm → execute → report, end to end",
  usage: "tenet run <file.md> --accept-proposed [--set r5=ordering] [--cap 2] [--concurrency 4] [--rungs 6]",
  options: { ...EXEC_OPTIONS, "accept-proposed": { type: "boolean" }, set: { type: "string", multiple: true }, name: { type: "string" } },
  async run({ values, positionals, out, err }) {
    const file = positionals[0];
    if (!file) {
      err("Give a policy file, e.g. samples/harrow-vale.md");
      return 1;
    }
    const policy = await policyForFile(file, await readFile(path.resolve(file), "utf8"), values.name as string | undefined);
    const run = await startAnalysis(policy);
    out(`Run ${run.id}: analyzing ${policy.name} …`);
    await waitForJob(run.id);
    let view = await readRunView(run.id);
    if (view.run.status !== "awaiting_review") {
      printRun(view, out);
      return view.run.status === "quarantined" || view.run.status === "complete" ? 0 : 1;
    }
    const ops: RuleOp[] = [];
    for (const s of list(values.set)) {
      const [id, type] = s.split("=");
      ops.push({ set_type: { ruleId: id, type: type as "constraint" } });
    }
    if (values["accept-proposed"]) {
      for (const r of view.rules) {
        const typed = ops.some((o) => "set_type" in o && o.set_type.ruleId === r.id);
        if (!typed && !r.parked && effectiveType(r, view.run.config.ambiguityThreshold) === null) ops.push({ park: { ruleId: r.id } });
      }
    }
    if (ops.length) await applyRuleOps(run.id, ops);
    await confirmRun(run.id);
    await waitForJob(run.id);
    view = await readRunView(run.id);
    out(`Confirmed; ${view.collisions.length} collision(s). Running tests …`);
    await startExecution(run.id, { spendCapUsd: num(values.cap), concurrency: num(values.concurrency), rungs: num(values.rungs), dismiss: list(values.dismiss) });
    await waitForJob(run.id);
    view = await readRunView(run.id);
    out(`Status: ${view.run.status}${view.run.statusReason ? ` — ${view.run.statusReason}` : ""}`);
    printSummary(await readOrComputeSummary(run.id), out);
    const spend = await keySpend();
    out(`Cumulative key spend ${money(spend.usd)}.`);
    return view.run.status === "complete" || view.run.status === "halted" ? 0 : 1;
  },
};

export const statusCommand: Command = {
  name: "status",
  summary: "A run's progress and its summary table",
  usage: "tenet status <runId>",
  async run({ positionals, out, err }) {
    const runId = positionals[0];
    if (!runId) {
      err("Give a run id.");
      return 1;
    }
    const view = await readRunView(runId);
    printRun(view, out);
    if (["generating", "executing", "reporting", "complete", "halted", "interrupted"].includes(view.run.status)) {
      printSummary(await readOrComputeSummary(runId), out);
    }
    const spend = await keySpend();
    out(`Cumulative key spend ${money(spend.usd)}.`);
    return 0;
  },
};
