import { callModel, type CallArgs } from "../../model/client";
import type { Target, TestDesign } from "../../schemas/records";
import type { RuleType } from "../../schemas/agents";

export type GenRule = { id: string; statement: string; quote: string; type: RuleType };

export type GenContext = {
  runId: string;
  policyText: string;
  target: Target;
  /** The cached system prompt for this generator kind in this run. */
  system: string;
  rungs: number;
  signal?: AbortSignal;
};

export const GENERATOR_MAX_TOKENS = 6000;

/** One call, then one regeneration if validation finds problems (agents §5, Code); keeps the better answer. */
export async function generateWithRetry<T>(
  args: Omit<CallArgs<T>, "user">,
  user: string,
  validate: (data: T) => string[],
): Promise<{ data: T; problems: string[] }> {
  const first = await callModel<T>({ ...args, user });
  const problems = validate(first.data);
  if (problems.length === 0) return { data: first.data, problems };
  const second = await callModel<T>({
    ...args,
    user: `${user}\n\nYour previous answer had these problems: ${problems.join("; ")}. Return the complete set again, corrected.`,
  });
  const problems2 = validate(second.data);
  return problems2.length <= problems.length ? { data: second.data, problems: problems2 } : { data: first.data, problems };
}

export function design(ownerId: string, kind: TestDesign["kind"], patch: Partial<TestDesign> = {}): TestDesign {
  return {
    ownerId,
    kind,
    context: null,
    impliedThreshold: null,
    thresholdDirection: null,
    thresholdSource: null,
    requiredBehavior: null,
    probe: null,
    warnings: [],
    generatedAt: new Date().toISOString(),
    ...patch,
  };
}

/** Truncates a word count so mock messages stay readable. */
export function clip(text: string, words = 24): string {
  const w = text.split(/\s+/);
  return w.length > words ? `${w.slice(0, words).join(" ")}…` : text;
}
