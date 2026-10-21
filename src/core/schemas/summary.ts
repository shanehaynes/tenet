import { z } from "zod";
import { LadderTactic, Probabilities, RuleType, SweepVariableKind } from "./agents";
import { Capabilities } from "./capabilities";
import { Coverage, RunConfig, ScenarioKind, Stage } from "./records";

// The contract between aggregate.ts, the report page, the standalone export and the evidence scripts
// (architecture §5). Computed once by aggregate.ts and saved as summary.json; every reader uses this.
// Additions on 2026-10-21: probabilities/confidence/parked on each card and map.arcs, so the ambiguity map
// renders from the summary alone.

export const RuleVerdict = z.enum([
  "pass",
  "partial",
  "fail",
  "unclear",
  "observed",
  "not_run",
  "designed_not_run",
  "parked",
  "pending",
]);
export type RuleVerdict = z.infer<typeof RuleVerdict>;

export const LadderCard = z.object({
  rungs: z.array(
    z.object({
      index: z.number(),
      tactic: LadderTactic,
      verdict: z.string().nullable(),
      verified: z.boolean(),
      scenarioId: z.string(),
    }),
  ),
  bentAt: z.number().nullable(),
  foldedAt: z.number().nullable(),
  caption: z.string(),
});

export const SweepCard = z.object({
  variable: z.object({ name: z.string(), unit: z.string().nullable(), kind: SweepVariableKind }),
  points: z.array(
    z.object({
      index: z.number(),
      value: z.number(),
      label: z.string(),
      behavior: z.string().nullable(),
      verified: z.boolean(),
      scenarioId: z.string(),
    }),
  ),
  impliedThreshold: z.number().nullable(),
  observedThreshold: z.object({ lastComplied: z.number().nullable(), firstRequired: z.number().nullable() }),
  nonMonotonic: z.boolean(),
  requiredBehaviorLabel: z.string(),
  caption: z.string(),
});

export const ParaphraseCard = z.object({
  items: z.array(
    z.object({ index: z.number(), dimension: z.string(), traitScore: z.number().nullable(), scenarioId: z.string() }),
  ),
  consistency: z.number().nullable(),
  modalScore: z.number().nullable(),
  outlierScenarioIds: z.array(z.string()),
});

export const ConflictOutcome = z.object({
  scenarioId: z.string(),
  honored: z.string().nullable(),
  evidence: z.string().nullable(),
  verified: z.boolean(),
  label: z.string().nullable(),
});

export const RuleCard = z.object({
  ruleId: z.string(),
  index: z.number(),
  statement: z.string(),
  quote: z.string(),
  type: RuleType.nullable(),
  probabilities: Probabilities.nullable(),
  confidence: z.number().nullable(),
  parked: z.boolean(),
  coverage: Coverage.nullable(),
  testKind: ScenarioKind.nullable(),
  verdict: RuleVerdict,
  ladder: LadderCard.nullable(),
  sweep: SweepCard.nullable(),
  paraphrase: ParaphraseCard.nullable(),
  conflicts: z.array(ConflictOutcome).nullable(),
  flat: z.object({ scenarioId: z.string(), verdict: z.string().nullable(), verified: z.boolean() }).nullable(),
  headlineEvidence: z.object({ scenarioId: z.string(), quote: z.string(), verified: z.boolean() }).nullable(),
  enforcedByTools: z.boolean().nullable(),
  warnings: z.array(z.string()),
});
export type RuleCard = z.infer<typeof RuleCard>;

export const UsageByStage = z.object({
  stage: Stage,
  calls: z.number(),
  inputTokens: z.number(),
  cachedTokens: z.number().nullable(),
  reasoningTokens: z.number().nullable(),
  outputTokens: z.number(),
  usd: z.number(),
  medianMs: z.number().nullable(),
});

export const Summary = z.object({
  runId: z.string(),
  policyId: z.string(),
  policyName: z.string(),
  kind: z.enum(["report", "no_testable_rules"]),
  partial: z.boolean(),
  generatedAt: z.string(),
  strip: z.object({
    rulesTotal: z.number(),
    rulesTested: z.number(),
    rulesP1NotRun: z.number(),
    rulesParked: z.record(z.string(), z.number()),
    failures: z.number(),
    partials: z.number(),
    ambiguities: z.number(),
    collisions: z.number(),
    scenariosTotal: z.number(),
    scenariosNotRun: z.number(),
    unverifiedCount: z.number(),
    truncatedCount: z.number(),
    calls: z.number(),
    inputTokens: z.number(),
    cachedTokens: z.number().nullable(),
    reasoningTokens: z.number().nullable(),
    outputTokens: z.number(),
    usd: z.number(),
    analysisUsd: z.number(),
    testUsd: z.number(),
    wallClockMs: z.number().nullable(),
  }),
  rules: z.array(RuleCard),
  map: z.object({
    threshold: z.number(),
    arcs: z.array(z.object({ collisionId: z.string(), ruleA: z.string(), ruleB: z.string(), dismissed: z.boolean() })),
  }),
  defects: z.object({
    ambiguities: z.array(
      z.object({
        ruleId: z.string(),
        statement: z.string(),
        probabilities: Probabilities.nullable(),
        parkedReason: z.string().nullable(),
        summary: z.string(),
      }),
    ),
    collisions: z.array(
      z.object({
        collisionId: z.string(),
        ruleA: z.string(),
        ruleB: z.string(),
        scenario: z.string(),
        outcome: z
          .object({ scenarioId: z.string(), honored: z.string().nullable(), evidence: z.string().nullable(), verified: z.boolean() })
          .nullable(),
        summary: z.string(),
      }),
    ),
  }),
  untestablePassages: z.array(z.string()),
  typedVsFlat: z.array(z.object({ ruleId: z.string(), flatVerdict: z.string(), typedVerdict: z.string() })).nullable(),
  usageByStage: z.array(UsageByStage),
  planted: z
    .array(z.object({ item: z.string(), expected: z.string(), found: z.boolean().nullable(), detail: z.string() }))
    .nullable(),
  config: RunConfig.extend({ modelString: z.string(), capabilities: Capabilities.partial().nullable() }),
});
export type Summary = z.infer<typeof Summary>;
