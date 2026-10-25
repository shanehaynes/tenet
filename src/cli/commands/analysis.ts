import { readFile } from "node:fs/promises";
import path from "node:path";
import { confirmRun, RunStateError, startAnalysis } from "../../core/pipeline/analysis";
import { waitForJob } from "../../core/pipeline/jobs";
import { policyForFile } from "../../core/pipeline/policies";
import { applyRuleOps, type RuleOp } from "../../core/pipeline/review";
import { readRunView, type RunView } from "../../core/pipeline/status";
import { effectiveType } from "../../core/schemas/records";
import { list, parseSetOps } from "../args";
import { money, table, truncate } from "../format";
import type { Command, CommandContext } from "../types";

export function printRun(view: RunView, out: CommandContext["out"]): void {
  const { run, rules, collisions } = view;
  out(`Run ${run.id} · ${run.policyName} · ${run.status}${run.statusReason ? ` — ${run.statusReason}` : ""}`);
  if (rules.length) {
    const threshold = run.config.ambiguityThreshold;
    out(
      table(
        ["#", "id", "proposed", "conf", "effective", "parked", "statement"],
        rules.map((r) => [
          r.index,
          r.id,
          r.proposedType ?? "—",
          r.confidence === null ? "—" : r.confidence.toFixed(2),
          effectiveType(r, threshold) ?? "—",
          r.parked ? (r.parkedReason ?? "yes") : "",
          truncate(r.statement, 70),
        ]),
      ),
    );
    const ambiguous = rules.filter((r) => r.parkedReason === "low_confidence").map((r) => r.index);
    if (ambiguous.length) out(`Low confidence (below ${threshold}), pre-parked: rules ${ambiguous.join(", ")}`);
  }
  if (collisions.length) {
    out("\nCollisions:");
    out(
      table(
        ["id", "rules", "dismissed", "scenario"],
        collisions.map((c) => [c.id, `${c.ruleA} vs ${c.ruleB}`, c.dismissed ? "yes" : "", truncate(c.scenario, 90)]),
      ),
    );
  } else if (run.status === "awaiting_collision_review") {
    out("\nNo collisions proposed.");
  }
  if (run.untestablePassages.length) out(`\nUntestable passages: ${run.untestablePassages.map((p) => `"${truncate(p, 60)}"`).join("; ")}`);
  if (run.warnings.length) out(`\nWarnings: ${run.warnings.join(" | ")}`);
  const t = run.totals;
  out(
    `\nCalls ${t.calls} · input ${t.inputTokens} (cached ${t.cachedTokens ?? "n/a"}) · output ${t.outputTokens} (reasoning ${t.reasoningTokens ?? "n/a"}) · ${money(t.usd)}`,
  );
}

export const analyzeCommand: Command = {
  name: "analyze",
  summary: "Scan, decompose and classify a policy file; prints the rules table and the run id",
  usage: "tenet analyze <file.md> [--name N]",
  options: { name: { type: "string" } },
  async run({ values, positionals, out, err }) {
    const file = positionals[0];
    if (!file) {
      err("Give a policy file, e.g. samples/harrow-vale.md");
      return 1;
    }
    const text = await readFile(path.resolve(file), "utf8");
    const policy = await policyForFile(file, text, values.name as string | undefined);
    if (policy.flagged) out(`Policy "${policy.name}" was flagged by the injection scanner.`);
    const run = await startAnalysis(policy);
    out(`Analyzing ${policy.name} (run ${run.id}) …`);
    await waitForJob(run.id);
    const view = await readRunView(run.id);
    printRun(view, out);
    return view.run.status === "failed" ? 1 : 0;
  },
};

export const rulesCommand: Command = {
  name: "rules",
  summary: "Override rule types, park or unpark rules; --accept-proposed parks anything still untyped; --keep parks every other rule",
  usage: "tenet rules <runId> [--set r5=ordering] [--park r13] [--unpark r9] [--accept-proposed] [--keep r2,r7,r11]",
  options: {
    set: { type: "string", multiple: true },
    park: { type: "string", multiple: true },
    unpark: { type: "string", multiple: true },
    "accept-proposed": { type: "boolean" },
    keep: { type: "string", multiple: true },
  },
  async run({ values, positionals, out, err }) {
    const runId = positionals[0];
    if (!runId) {
      err("Give a run id.");
      return 1;
    }
    const set = parseSetOps(values.set);
    if ("error" in set) {
      err(set.error);
      return 1;
    }
    const ops: RuleOp[] = [...set.ops];
    for (const id of list(values.park)) ops.push({ park: { ruleId: id } });
    for (const id of list(values.unpark)) ops.push({ unpark: { ruleId: id } });
    const keep = new Set(list(values.keep).flatMap((k) => k.split(",").map((x) => x.trim()).filter(Boolean)));
    if (values["accept-proposed"] || keep.size) {
      const view = await readRunView(runId);
      const unknown = [...keep].filter((id) => !view.rules.some((r) => r.id === id));
      if (unknown.length) {
        err(`--keep: no rule ${unknown.join(", ")} in this run.`);
        return 1;
      }
      const parking = new Set(ops.flatMap((o) => ("park" in o ? [o.park.ruleId] : [])));
      for (const r of view.rules) {
        if (r.parked || parking.has(r.id)) continue;
        const untyped = effectiveType(r, view.run.config.ambiguityThreshold) === null && !ops.some((o) => "set_type" in o && o.set_type.ruleId === r.id);
        if ((keep.size && !keep.has(r.id)) || (values["accept-proposed"] && untyped)) ops.push({ park: { ruleId: r.id } });
      }
    }
    try {
      if (ops.length) await applyRuleOps(runId, ops);
    } catch (e) {
      if (e instanceof RunStateError) {
        err(e.message);
        return 1;
      }
      throw e;
    }
    printRun(await readRunView(runId), out);
    return 0;
  },
};

export const confirmCommand: Command = {
  name: "confirm",
  summary: "Confirm the reviewed rules and map collisions",
  usage: "tenet confirm <runId>",
  async run({ positionals, out, err }) {
    const runId = positionals[0];
    if (!runId) {
      err("Give a run id.");
      return 1;
    }
    try {
      await confirmRun(runId);
    } catch (e) {
      if (e instanceof RunStateError) {
        err(e.message);
        return 1;
      }
      throw e;
    }
    await waitForJob(runId);
    const view = await readRunView(runId);
    printRun(view, out);
    return view.run.status === "failed" ? 1 : 0;
  },
};
