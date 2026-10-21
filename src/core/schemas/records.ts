import { z } from "zod";
import { LadderTactic, Probabilities, RuleType, ScanResult, SweepVariableKind } from "./agents";

// Stored records (architecture §5, amended 2026-10-21). These are never sent to the model, so records and
// unions are fine here.

export const STAGES = [
  "probe",
  "scanner",
  "decomposer",
  "classifier",
  "collisions",
  "generator",
  "executor",
  "judge",
  "reporter",
  "target",
] as const;
export const Stage = z.enum(STAGES);
export type Stage = z.infer<typeof Stage>;

/** Stages whose spend counts against a run's test budget; analysis stages are bounded by loop guards instead. */
export const TEST_STAGES: ReadonlySet<Stage> = new Set<Stage>(["generator", "executor", "judge", "reporter", "target"]);

export const ProviderName = z.enum(["portkey", "openai", "mock"]);
export type ProviderName = z.infer<typeof ProviderName>;

// Policies

export const SampleInfo = z.object({
  key: z.string(),
  role: z.enum(["fictional", "safety_demo", "real_agent", "published"]),
});
export type SampleInfo = z.infer<typeof SampleInfo>;

export const Policy = z.object({
  id: z.string(),
  name: z.string(),
  text: z.string(),
  source: z.enum(["sample", "paste", "upload"]),
  sample: SampleInfo.nullable(),
  flagged: z.boolean(),
  scan: ScanResult.nullable(),
  createdAt: z.string(),
});
export type Policy = z.infer<typeof Policy>;

// Targets (architecture §4.6)

export const ModelTarget = z.object({ kind: z.literal("model"), provider: ProviderName, model: z.string() });
export const HttpTarget = z.object({
  kind: z.literal("http"),
  name: z.string(),
  url: z.string(),
  agent: z.string().nullable(),
  headers: z.record(z.string(), z.string()),
  timeoutMs: z.number(),
  resetPerScenario: z.boolean(),
});
export const Target = z.discriminatedUnion("kind", [ModelTarget, HttpTarget]);
export type Target = z.infer<typeof Target>;

// Runs

export const RUN_STATUSES = [
  "created",
  "scanning",
  "quarantined",
  "decomposing",
  "classifying",
  "awaiting_review",
  "mapping_collisions",
  "awaiting_collision_review",
  "generating",
  "executing",
  "reporting",
  "complete",
  "halted",
  "failed",
  "interrupted",
  "cancelled",
] as const;
export const RunStatus = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof RunStatus>;

export const SCENARIO_KINDS = ["ladder", "sweep", "paraphrase", "conflict", "flat"] as const;
export const ScenarioKind = z.enum(SCENARIO_KINDS);
export type ScenarioKind = z.infer<typeof ScenarioKind>;

export const RunConfig = z.object({
  provider: ProviderName,
  target: Target,
  targetModel: z.string(),
  judgeModel: z.string(),
  spendCapUsd: z.number(),
  concurrency: z.number(),
  ambiguityThreshold: z.number(),
  flatComparison: z.boolean(),
  rungs: z.number(),
  /** Generators switched off by the Gate 1 cut line; rules of those kinds become p1_type_not_run. */
  disabledGenerators: z.array(ScenarioKind),
});
export type RunConfig = z.infer<typeof RunConfig>;

export const Totals = z.object({
  calls: z.number(),
  inputTokens: z.number(),
  cachedTokens: z.number().nullable(),
  reasoningTokens: z.number().nullable(),
  outputTokens: z.number(),
  usd: z.number(),
  analysisUsd: z.number(),
  testUsd: z.number(),
});
export type Totals = z.infer<typeof Totals>;

export const Run = z.object({
  id: z.string(),
  policyId: z.string(),
  policyName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: RunStatus,
  statusReason: z.string().nullable(),
  config: RunConfig,
  heartbeatAt: z.string().nullable(),
  startedExecutionAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  wallClockMs: z.number().nullable(),
  totals: Totals,
  /** Next number for r{n} rule ids; split and merge take fresh numbers. */
  nextRuleNumber: z.number(),
  untestablePassages: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type Run = z.infer<typeof Run>;

// Rules, collisions, scenarios

export const Span = z.object({ start: z.number(), end: z.number() });
export type Span = z.infer<typeof Span>;

export const Coverage = z.enum(["tested", "p1_type_not_run", "parked", "not_run"]);
export type Coverage = z.infer<typeof Coverage>;

export const Rule = z.object({
  id: z.string(),
  runId: z.string(),
  index: z.number(),
  statement: z.string(),
  quote: z.string(),
  span: Span.nullable(),
  located: z.boolean(),
  section: z.string().nullable(),
  proposedType: RuleType.nullable(),
  probabilities: Probabilities.nullable(),
  confidence: z.number().nullable(),
  rationale: z.string().nullable(),
  ambiguityNote: z.string().nullable(),
  userType: RuleType.nullable(),
  parked: z.boolean(),
  parkedReason: z.enum(["low_confidence", "user", "untestable"]).nullable(),
  origin: z.enum(["extracted", "split", "merged"]),
  parentIds: z.array(z.string()),
  coverage: Coverage.nullable(),
});
export type Rule = z.infer<typeof Rule>;

export const Collision = z.object({
  id: z.string(),
  runId: z.string(),
  ruleA: z.string(),
  ruleB: z.string(),
  scenario: z.string(),
  whyConflict: z.string(),
  dismissed: z.boolean(),
});
export type Collision = z.infer<typeof Collision>;

export const Scenario = z.object({
  id: z.string(),
  runId: z.string(),
  ruleId: z.string().nullable(),
  collisionId: z.string().nullable(),
  kind: ScenarioKind,
  index: z.number(),
  tactic: LadderTactic.nullable(),
  variable: z.object({ name: z.string(), unit: z.string().nullable(), kind: SweepVariableKind }).nullable(),
  value: z.union([z.number(), z.string()]).nullable(),
  label: z.string().nullable(),
  dimension: z.string().nullable(),
  context: z.object({ persona: z.string(), situation: z.string() }).nullable(),
  /** Conflict scenarios: the two sides (A is rule A, or the higher-ranked value) and what honoring each means. */
  sides: z
    .object({ a: z.object({ label: z.string(), requires: z.string() }), b: z.object({ label: z.string(), requires: z.string() }) })
    .nullable(),
  userTurn: z.string(),
  status: z.enum(["pending", "running", "done", "not_run"]),
  error: z.string().nullable(),
});
export type Scenario = z.infer<typeof Scenario>;

/** What a generator decided for one rule or collision: the shared context and the parameters aggregation needs. */
export const TestDesign = z.object({
  ownerId: z.string(),
  kind: ScenarioKind,
  context: z.object({ persona: z.string(), situation: z.string() }).nullable(),
  impliedThreshold: z.number().nullable(),
  thresholdDirection: z.enum(["above", "below"]).nullable(),
  thresholdSource: z.string().nullable(),
  requiredBehavior: z.string().nullable(),
  probe: z.string().nullable(),
  warnings: z.array(z.string()),
  generatedAt: z.string(),
});
export type TestDesign = z.infer<typeof TestDesign>;

export const TargetAction = z.object({ name: z.string(), arguments: z.unknown(), result: z.unknown() });
export type TargetAction = z.infer<typeof TargetAction>;

export const Transcript = z.object({
  scenarioId: z.string(),
  systemPrompt: z.string().nullable(),
  messages: z.array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() })),
  finishReason: z.string().nullable(),
  truncated: z.boolean(),
  ms: z.number(),
  model: z.string(),
  actions: z.array(TargetAction).nullable(),
  targetUsage: z
    .object({ inputTokens: z.number(), outputTokens: z.number(), cachedTokens: z.number().nullable(), requests: z.number() })
    .nullable(),
});
export type Transcript = z.infer<typeof Transcript>;

export const Verdict = z.object({
  scenarioId: z.string(),
  rubric: ScenarioKind,
  verdict: z.string(),
  evidence: z.string().nullable(),
  verified: z.boolean(),
  confidence: z.number(),
  note: z.string().nullable(),
  /** The target's reply was cut off by the token limit (the judge was told). */
  truncated: z.boolean(),
  judgedAt: z.string(),
});
export type Verdict = z.infer<typeof Verdict>;

// Logs

export const UsageEvent = z.object({
  ts: z.string(),
  runId: z.string().nullable(),
  ruleId: z.string().nullable(),
  scenarioId: z.string().nullable(),
  stage: Stage,
  provider: z.string(),
  model: z.string(),
  role: z.enum(["agent", "target"]),
  kind: z.enum(["call", "retry", "repair", "length_retry"]),
  attempt: z.number(),
  ok: z.boolean(),
  inputTokens: z.number(),
  cachedTokens: z.number().nullable(),
  reasoningTokens: z.number().nullable(),
  outputTokens: z.number(),
  ms: z.number(),
  usd: z.number(),
  finishReason: z.string().nullable(),
  error: z.string().nullable(),
  responseMode: z.enum(["strict", "json_object", "prompt", "text"]),
  usageEstimated: z.boolean(),
  reportedByTarget: z.boolean(),
});
export type UsageEvent = z.infer<typeof UsageEvent>;

export const RunEvent = z.object({
  ts: z.string(),
  level: z.enum(["info", "warn", "error"]),
  stage: z.string(),
  message: z.string(),
  data: z.unknown().optional(),
});
export type RunEvent = z.infer<typeof RunEvent>;

/** A rule's effective type (architecture §5): the user's override, else the proposal if confident enough. */
export function effectiveType(rule: Pick<Rule, "userType" | "proposedType" | "confidence">, threshold: number): RuleType | null {
  if (rule.userType) return rule.userType;
  if (rule.proposedType && rule.confidence !== null && rule.confidence >= threshold) return rule.proposedType;
  return null;
}
