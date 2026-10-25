import { z } from "zod";
import { ruleId } from "../ids";
import { RuleType } from "../schemas/agents";
import type { Collision, Rule } from "../schemas/records";
import { appendEvent, withRun } from "../store/runs";
import { RunStateError } from "./analysis";

// Review overrides (PRD Req. 4; architecture §8): set a type, park, unpark, split, merge. Only while the run
// awaits review. Split and merge create rules with fresh r{n} ids, origin and parentIds, and no proposed type:
// the user types them.

export const RuleOp = z.union([
  z.object({ set_type: z.object({ ruleId: z.string(), type: RuleType }) }),
  z.object({ park: z.object({ ruleId: z.string() }) }),
  z.object({ unpark: z.object({ ruleId: z.string() }) }),
  z.object({ split: z.object({ ruleId: z.string(), statements: z.array(z.string().min(1)).min(2).max(6) }) }),
  z.object({ merge: z.object({ ruleIds: z.array(z.string()).min(2).max(6) }) }),
]);
export type RuleOp = z.infer<typeof RuleOp>;
export const RuleOps = z.object({ ops: z.array(RuleOp).min(1).max(50) });

function blankRule(base: Rule, id: string, patch: Partial<Rule>): Rule {
  return {
    ...base,
    id,
    proposedType: null,
    probabilities: null,
    confidence: null,
    rationale: null,
    ambiguityNote: null,
    userType: null,
    parked: false,
    parkedReason: null,
    coverage: null,
    ...patch,
  };
}

/** Applies ops in order to a rules list; returns the new list and the next rule number. Pure. */
export function applyOps(rules: Rule[], ops: RuleOp[], nextRuleNumber: number): { rules: Rule[]; nextRuleNumber: number } {
  let list = rules.map((r) => ({ ...r }));
  let next = nextRuleNumber;
  const find = (id: string) => {
    const i = list.findIndex((r) => r.id === id);
    if (i < 0) throw new RunStateError(`Rule ${id} not found`, "not_found");
    return i;
  };
  for (const op of ops) {
    if ("set_type" in op) {
      const i = find(op.set_type.ruleId);
      list[i] = { ...list[i], userType: op.set_type.type, parked: false, parkedReason: null };
    } else if ("park" in op) {
      const i = find(op.park.ruleId);
      list[i] = { ...list[i], parked: true, parkedReason: "user" };
    } else if ("unpark" in op) {
      const i = find(op.unpark.ruleId);
      list[i] = { ...list[i], parked: false, parkedReason: null };
    } else if ("split" in op) {
      const i = find(op.split.ruleId);
      const parent = list[i];
      const children = op.split.statements.map((statement) =>
        blankRule(parent, ruleId(next++), { statement: statement.trim(), origin: "split", parentIds: [parent.id] }),
      );
      list.splice(i, 1, ...children);
    } else {
      const indexes = op.merge.ruleIds.map(find).sort((a, b) => a - b);
      const parents = indexes.map((i) => list[i]);
      const spans = parents.map((p) => p.span);
      const span = spans.every((s) => s !== null)
        ? { start: Math.min(...spans.map((s) => s!.start)), end: Math.max(...spans.map((s) => s!.end)) }
        : null;
      const merged = blankRule(parents[0], ruleId(next++), {
        statement: parents.map((p) => p.statement).join(" "),
        quote: parents.map((p) => p.quote).join(" "),
        span,
        located: span !== null,
        origin: "merged",
        parentIds: parents.map((p) => p.id),
      });
      list = list.filter((_, i) => !indexes.includes(i));
      list.splice(indexes[0], 0, merged);
    }
  }
  return { rules: list.map((r, i) => ({ ...r, index: i + 1 })), nextRuleNumber: next };
}

export async function applyRuleOps(runId: string, input: RuleOp[]): Promise<Rule[]> {
  const ops = z.array(RuleOp).parse(input); // a bad type would otherwise be written and break every later read
  const rules = await withRun(runId, async (tx) => {
    const run = await tx.get("run");
    if (run.status !== "awaiting_review") throw new RunStateError(`Rules can be changed only while the run awaits review (it is ${run.status}).`);
    const out = applyOps(await tx.get("rules"), ops, run.nextRuleNumber);
    tx.set("rules", out.rules);
    tx.set("run", { ...run, nextRuleNumber: out.nextRuleNumber });
    return out.rules;
  });
  await appendEvent(runId, { stage: "review", message: `${ops.length} override${ops.length === 1 ? "" : "s"} applied` });
  return rules;
}

export const CollisionPatch = z.object({ dismiss: z.array(z.string()).default([]), restore: z.array(z.string()).default([]) });

export async function patchCollisions(runId: string, patch: { dismiss: string[]; restore: string[] }): Promise<Collision[]> {
  return withRun(runId, async (tx) => {
    const run = await tx.get("run");
    if (run.status !== "awaiting_collision_review") {
      throw new RunStateError(`Collisions can be changed only before tests run (the run is ${run.status}).`);
    }
    const collisions = (await tx.get("collisions")).map((c) => ({
      ...c,
      dismissed: patch.dismiss.includes(c.id) ? true : patch.restore.includes(c.id) ? false : c.dismissed,
    }));
    tx.set("collisions", collisions);
    return collisions;
  });
}
