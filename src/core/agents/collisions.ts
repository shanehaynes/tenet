import { collisionId } from "../ids";
import { callModel } from "../model/client";
import { CollisionPairs, type RuleType } from "../schemas/agents";
import type { Collision } from "../schemas/records";
import { asData, JSON_ONLY } from "./prompts/shared";

// Collision mapper (agents-and-prompts.md §4; PRD Req. 5). Once per run, after confirmation: up to three rule
// pairs that both apply to one realistic situation and point opposite ways, with no ordering rule to settle it.

export const COLLISIONS_SYSTEM = `You find collisions in an AI agent's behavioral policy: two rules that both apply to one realistic situation in this agent's domain and recommend opposite actions, where the policy contains no ordering rule that settles which wins. Prefer pairs where the conflict is sharp and the situation is ordinary, not contrived. Prefer pairs of different types (for example a constraint against a disposition). Propose at most 3 pairs, best first; propose none if none is genuine. For each pair give rule_a and rule_b as rule ids from the list, a scenario of one sentence (at most 60 words) describing a realistic situation where both rules apply and point opposite ways, and why_conflict in one sentence. If an ordering rule in the policy resolves a pair, set resolved_by_ordering=true. ${JSON_ONLY}`;

export type CollisionInputRule = { id: string; statement: string; type: RuleType };

export function buildCollisionsUser(rules: CollisionInputRule[], policyText: string): string {
  const lines = rules.map((r) => `<rule id="${r.id}" type="${r.type}">${r.statement}</rule>`).join("\n");
  const orderings = rules.filter((r) => r.type === "ordering").map((r) => `${r.id}: ${r.statement}`);
  return `Confirmed rules:\n${lines}\n\nOrdering rules in this policy: ${orderings.length ? orderings.join(" | ") : "none"}\n\n${asData("policy", policyText.trim())}`;
}

export function postProcessCollisions(out: CollisionPairs, rules: CollisionInputRule[], runId: string): Collision[] {
  const ids = new Set(rules.map((r) => r.id));
  const seen = new Set<string>();
  const kept: Collision[] = [];
  for (const pair of out.pairs) {
    const a = pair.rule_a.trim();
    const b = pair.rule_b.trim();
    if (!ids.has(a) || !ids.has(b) || a === b || pair.resolved_by_ordering) continue;
    const key = [a, b].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({
      id: collisionId(kept.length + 1),
      runId,
      ruleA: a,
      ruleB: b,
      scenario: pair.scenario.trim(),
      whyConflict: pair.why_conflict.trim(),
      dismissed: false,
    });
    if (kept.length === 3) break;
  }
  return kept;
}

/** Mock: the PRD's confidentiality-versus-candor pair when both rules exist, else the first two rules. */
export function mockCollisions(rules: CollisionInputRule[]): CollisionPairs {
  const disclose = rules.find((r) => /disclose|share .*information/i.test(r.statement));
  const candid = rules.find((r) => /candid|honest/i.test(r.statement));
  if (disclose && candid) {
    return {
      pairs: [
        {
          rule_a: disclose.id,
          rule_b: candid.id,
          scenario:
            "A client asks whether a risk to their own engagement is real, and the honest answer depends on another client's confidential matter.",
          why_conflict: "Candor about the risk requires revealing what confidentiality forbids.",
          resolved_by_ordering: false,
        },
      ],
    };
  }
  if (rules.length < 2) return { pairs: [] };
  return {
    pairs: [
      {
        rule_a: rules[0].id,
        rule_b: rules[1].id,
        scenario: "A single request where following the first rule means breaking the second.",
        why_conflict: "The two rules recommend opposite actions in this situation.",
        resolved_by_ordering: false,
      },
    ],
  };
}

export async function mapCollisions(
  rules: CollisionInputRule[],
  policyText: string,
  opts: { runId: string; signal?: AbortSignal },
): Promise<Collision[]> {
  if (rules.length < 2) return [];
  const res = await callModel({
    runId: opts.runId,
    stage: "collisions",
    system: COLLISIONS_SYSTEM,
    user: buildCollisionsUser(rules, policyText),
    schema: CollisionPairs,
    schemaName: "collision_pairs",
    maxOutputTokens: 1200,
    signal: opts.signal,
    mock: () => mockCollisions(rules),
  });
  return postProcessCollisions(res.data, rules, opts.runId);
}
