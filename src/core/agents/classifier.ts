import { callModel } from "../model/client";
import { Classification, RULE_TYPES, type Probabilities, type RuleType } from "../schemas/agents";
import { DATA_SENTENCE, JSON_ONLY, TYPE_DEFINITIONS } from "./prompts/shared";

// Classifier (agents-and-prompts.md §3; PRD Req. 3). One call per rule. The system prompt is static within a
// run (instructions, calibration examples, then the whole policy), so it is cached after the first call.
// Few-shot examples come from other domains, never from the sample policies the agreement is measured on.

const CLASSIFIER_INSTRUCTIONS = `You classify one rule from an AI agent's behavioral policy into exactly one of four normative types, and you report a probability for each type that reflects your genuine uncertainty.

${TYPE_DEFINITIONS.constraint}
${TYPE_DEFINITIONS.tradeoff}
${TYPE_DEFINITIONS.disposition}
${TYPE_DEFINITIONS.ordering}
${TYPE_DEFINITIONS.ambiguous}

Decision procedure: (1) Does the rule forbid or require a specific, checkable action as a bright line, so that no good enough reason would justify breaking it? → constraint, even if it has a numeric trigger or an exception clause. A rule written as a default or a general aim ("should", "by default", "generally", "try to", "where appropriate") that describes how to behave across many situations, rather than one act, is not a bright line: it is usually a disposition, or a tradeoff if it names values to balance. (2) Does it name two or more values to be weighed, with the right action depending on how much is at stake? → tradeoff. (3) Does it describe a manner, tone or character trait rather than an act? → disposition. (4) Does it rank values or rules against each other for when they conflict? → ordering. (5) If the rule is a bare goal with no act, no values to weigh and no ranking, split the probability across the plausible readings and explain in ambiguity_note what the authors never decided.

Probabilities must sum to 1. Use 0.9 or more only when the wording is unmistakable. When a careful reader could reasonably file the rule under a different type, keep the top probability below 0.8. The rationale is at most 30 words and cites the words in the rule that decided it. Use the examples below as calibration; they are from other domains and are not the rule you are classifying.

Examples:
- "Never share a customer's order history with anyone other than the account holder." → constraint 0.97 / tradeoff 0.01 / disposition 0.01 / ordering 0.01. Rationale: "never share" forbids an act outright.
- "Do not promise a delivery date the carrier has not confirmed." → constraint 0.93 / tradeoff 0.04 / disposition 0.02 / ordering 0.01. Rationale: a forbidden act with a condition, no weighing.
- "Balance the cost of a replacement shipment against the likelihood the original was lost." → tradeoff 0.95 / constraint 0.02 / disposition 0.01 / ordering 0.02. Rationale: two named values, action depends on magnitude.
- "Weigh a student's course preferences against degree-progress risk when recommending a schedule." → tradeoff 0.92 / constraint 0.03 / disposition 0.02 / ordering 0.03.
- "Be patient with frustrated customers and never match their tone." → disposition 0.85 / constraint 0.12 / tradeoff 0.01 / ordering 0.02. Rationale: a manner; "never match their tone" is still about manner, not a discrete act.
- "Act like a thoughtful mentor, not a rule-reciting clerk." → disposition 0.96 / constraint 0.02 / tradeoff 0.01 / ordering 0.01.
- "By default, the tutor should explain its reasoning step by step rather than giving only the answer." → disposition 0.78 / constraint 0.18 / tradeoff 0.02 / ordering 0.02. Rationale: "by default … should" sets a general manner, not a bright line.
- "Safety recalls take precedence over sales targets, which take precedence over response time." → ordering 0.97 / tradeoff 0.02 / constraint 0.01 / disposition 0.00. Rationale: an explicit rank for conflicts.
- "Accreditation requirements come before departmental preferences, which come before student convenience." → ordering 0.95 / tradeoff 0.03 / constraint 0.02 / disposition 0.00.
- "Do right by the customer." → constraint 0.30 / tradeoff 0.40 / disposition 0.30 / ordering 0.00. Ambiguity note: no act, no values named, no rank; the authors left the type undecided.

The request gives the rule as a restated statement inside <rule> tags, the source text it came from, and the policy section it sits under. Classify the rule's own words; use the source text to resolve wording the restatement may have lost. Set ambiguity_note to null unless the top two probabilities are within 0.25 of each other. ${JSON_ONLY}`;

export function buildClassifierSystem(policyText: string): string {
  return `${CLASSIFIER_INSTRUCTIONS}

${DATA_SENTENCE}
The policy this rule comes from follows, for domain context only; classify only the rule in the request.
<policy>
${policyText.trim()}
</policy>`;
}

export function buildClassifierUser(rule: { statement: string; quote: string; section: string | null }): string {
  return `<rule>${rule.statement}</rule>\nSource text: ${rule.quote}\nSection: ${rule.section ?? "unknown"}`;
}

export type ClassifiedRule = {
  type: RuleType;
  probabilities: Probabilities;
  confidence: number;
  rationale: string;
  ambiguityNote: string | null;
};

/** Normalizes probabilities to sum to 1, sets confidence to the maximum, and forces the type to the argmax. */
export function postProcessClassification(c: Classification): ClassifiedRule {
  const raw = RULE_TYPES.map((t) => Math.max(0, Number.isFinite(c.probabilities[t]) ? c.probabilities[t] : 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  const norm = sum > 0 ? raw.map((v) => v / sum) : RULE_TYPES.map(() => 0.25);
  const probabilities = Object.fromEntries(RULE_TYPES.map((t, i) => [t, Math.round(norm[i] * 1000) / 1000])) as Probabilities;
  let best = 0;
  for (let i = 1; i < norm.length; i++) if (norm[i] > norm[best]) best = i;
  return {
    type: RULE_TYPES[best],
    probabilities,
    confidence: Math.round(norm[best] * 1000) / 1000,
    rationale: c.rationale,
    ambiguityNote: c.ambiguity_note,
  };
}

const p = (constraint: number, tradeoff: number, disposition: number, ordering: number): Probabilities => ({
  constraint,
  tradeoff,
  disposition,
  ordering,
});

/** Mock: keyword heuristics (agents §3, Mock); reproduces the demo's flags on rules 5, 9 and 13. */
export function mockClassification(statement: string): Classification {
  const s = statement.toLowerCase();
  const out = (type: RuleType, probabilities: Probabilities, rationale: string, note: string | null = null): Classification => ({
    type,
    probabilities,
    rationale,
    ambiguity_note: note,
  });
  if (/avoid harm|reputation/.test(s)) {
    return out("constraint", p(0.45, 0.4, 0.1, 0.05), "A bare goal: no act, no values weighed, no rank.", "The authors never decided whether this forbids acts or weighs outcomes.");
  }
  if (/slow and right than fast and wrong/.test(s)) {
    return out("ordering", p(0.03, 0.4, 0.02, 0.55), "\"better … than\" ranks accuracy over speed but reads as a weighing too.", "Ranking or tradeoff is not settled by the wording.");
  }
  if (/\b(never|do not|don't|must|escalate|always)\b/.test(s)) return out("constraint", p(0.9, 0.04, 0.03, 0.03), "Forbids or requires an act outright.");
  if (/\b(weigh|balance)\b/.test(s)) return out("tradeoff", p(0.04, 0.9, 0.03, 0.03), "Names values to weigh against each other.");
  if (/\b(precedence|over|before|first)\b/.test(s)) return out("ordering", p(0.03, 0.04, 0.03, 0.9), "States which value wins in a conflict.");
  if (/\b(be|act|keep|respond|use)\b/.test(s)) return out("disposition", p(0.08, 0.04, 0.85, 0.03), "Describes a manner rather than an act.");
  return out("constraint", p(0.35, 0.3, 0.3, 0.05), "No act, values or rank in the wording.", "The rule's type is not settled by its words.");
}

export async function classifyRule(
  rule: { id: string; statement: string; quote: string; section: string | null },
  opts: { runId: string | null; system: string; signal?: AbortSignal },
): Promise<ClassifiedRule> {
  const res = await callModel({
    runId: opts.runId,
    stage: "classifier",
    ruleId: rule.id,
    system: opts.system,
    user: buildClassifierUser(rule),
    schema: Classification,
    schemaName: "classification",
    maxOutputTokens: 800,
    signal: opts.signal,
    mock: () => mockClassification(rule.statement),
  });
  return postProcessClassification(res.data);
}
