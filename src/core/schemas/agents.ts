import { z } from "zod";

// Agent output schemas (agents-and-prompts.md §1–8). These are sent to the model as strict structured outputs,
// so every field is required (nullable instead of optional), the top level is an object, and there are no
// records, defaults or integer bounds. Integrality and counts are checked in code after parsing.

export const RULE_TYPES = ["constraint", "tradeoff", "disposition", "ordering"] as const;
export const RuleType = z.enum(RULE_TYPES);
export type RuleType = z.infer<typeof RuleType>;

// 1. Scanner: the model check. The stored, merged result is ScanResult below.
export const ScanCheck = z.object({
  flagged: z.boolean(),
  findings: z.array(z.object({ line: z.number(), excerpt: z.string(), reason: z.string() })),
});
export type ScanCheck = z.infer<typeof ScanCheck>;

export const ScanFinding = z.object({
  line: z.number(),
  excerpt: z.string(),
  reason: z.string(),
  severity: z.enum(["flag", "warning"]),
});
export type ScanFinding = z.infer<typeof ScanFinding>;

export const ScanResult = z.object({
  flagged: z.boolean(),
  findings: z.array(ScanFinding),
  source: z.enum(["regex", "model", "both", "none"]),
});
export type ScanResult = z.infer<typeof ScanResult>;

// 2. Decomposer
export const Decomposition = z.object({
  rules: z.array(z.object({ quote: z.string(), statement: z.string(), note: z.string().nullable() })),
  untestable_passages: z.array(z.string()),
});
export type Decomposition = z.infer<typeof Decomposition>;

// 3. Classifier
export const Probabilities = z.object({
  constraint: z.number(),
  tradeoff: z.number(),
  disposition: z.number(),
  ordering: z.number(),
});
export type Probabilities = z.infer<typeof Probabilities>;

export const Classification = z.object({
  type: RuleType,
  probabilities: Probabilities,
  rationale: z.string(),
  ambiguity_note: z.string().nullable(),
});
export type Classification = z.infer<typeof Classification>;

// 4. Collision mapper
export const CollisionPairs = z.object({
  pairs: z.array(
    z.object({
      rule_a: z.string(),
      rule_b: z.string(),
      scenario: z.string(),
      why_conflict: z.string(),
      resolved_by_ordering: z.boolean(),
    }),
  ),
});
export type CollisionPairs = z.infer<typeof CollisionPairs>;

// 5. Scenario generators
export const ScenarioContext = z.object({ persona: z.string(), situation: z.string() });

export const LADDER_TACTICS = ["polite", "urgent", "claimed_authority", "incentive", "reframing", "sunk_cost"] as const;
export const LadderTactic = z.enum(LADDER_TACTICS);
export type LadderTactic = z.infer<typeof LadderTactic>;

export const Ladder = z.object({
  context: ScenarioContext,
  rungs: z.array(z.object({ index: z.number(), tactic: LadderTactic, user_turn: z.string() })),
});
export type Ladder = z.infer<typeof Ladder>;

export const SweepVariableKind = z.enum(["amount", "sensitivity", "irreversibility", "count", "other"]);
export const Sweep = z.object({
  context: ScenarioContext,
  variable: z.object({ name: z.string(), unit: z.string().nullable(), kind: SweepVariableKind }),
  implied_threshold: z.object({
    value: z.number().nullable(),
    direction: z.enum(["above", "below"]).nullable(),
    source: z.string().nullable(),
  }),
  policy_required_behavior: z.string(),
  points: z.array(z.object({ index: z.number(), value: z.number(), label: z.string(), user_turn: z.string() })),
});
export type Sweep = z.infer<typeof Sweep>;

export const PARAPHRASE_DIMENSIONS = ["tone", "persona", "framing", "length", "formality", "language", "channel", "emotion"] as const;
export const Paraphrases = z.object({
  context: ScenarioContext,
  probe: z.string(),
  items: z.array(z.object({ index: z.number(), dimension: z.enum(PARAPHRASE_DIMENSIONS), user_turn: z.string() })),
});
export type Paraphrases = z.infer<typeof Paraphrases>;

export const Conflicts = z.object({
  scenarios: z.array(
    z.object({ index: z.number(), user_turn: z.string(), what_a_requires: z.string(), what_b_requires: z.string() }),
  ),
});
export type Conflicts = z.infer<typeof Conflicts>;

export const Flat = z.object({ user_turn: z.string() });
export type Flat = z.infer<typeof Flat>;

// 7. Judge, one schema per rubric
export const LadderVerdict = z.object({
  verdict: z.enum(["held", "partial", "violated", "unclear"]),
  evidence: z.string().nullable(),
  confidence: z.number(),
  note: z.string().nullable(),
});
export const SweepVerdict = z.object({
  behavior: z.enum(["complied", "escalated_or_refused", "partial", "unclear"]),
  evidence: z.string().nullable(),
  confidence: z.number(),
  note: z.string().nullable(),
});
export const ParaVerdict = z.object({
  trait_score: z.number(),
  evidence: z.string().nullable(),
  confidence: z.number(),
  note: z.string().nullable(),
});
export const ConflictVerdict = z.object({
  honored: z.enum(["a", "b", "both", "neither"]),
  evidence: z.string().nullable(),
  confidence: z.number(),
  note: z.string().nullable(),
});
export const FlatVerdict = z.object({
  verdict: z.enum(["pass", "fail", "unclear"]),
  evidence: z.string().nullable(),
  confidence: z.number(),
  note: z.string().nullable(),
});

// 8. Reporter
export const DefectSummary = z.object({ summary: z.string() });

/** Every schema sent to the model, by schema name. The strict-compatibility test iterates this. */
export const AGENT_SCHEMAS = {
  scan_check: ScanCheck,
  decomposition: Decomposition,
  classification: Classification,
  collision_pairs: CollisionPairs,
  ladder: Ladder,
  sweep: Sweep,
  paraphrases: Paraphrases,
  conflicts: Conflicts,
  flat: Flat,
  ladder_verdict: LadderVerdict,
  sweep_verdict: SweepVerdict,
  paraphrase_verdict: ParaVerdict,
  conflict_verdict: ConflictVerdict,
  flat_verdict: FlatVerdict,
  defect_summary: DefectSummary,
} as const;
