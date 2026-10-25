import type { RuleOp } from "../core/pipeline/review";
import { RuleType } from "../core/schemas/agents";

/** A repeatable string option as a list (absent → []). */
export function list(value: unknown): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}

/** Repeated `--set <ruleId>=<type>` values as set_type ops, or the message for the first bad one. */
export function parseSetOps(value: unknown): { ops: RuleOp[] } | { error: string } {
  const ops: RuleOp[] = [];
  for (const s of list(value)) {
    const [id, type] = s.split("=");
    const parsed = RuleType.safeParse(type);
    if (!id || !parsed.success) return { error: `--set expects <ruleId>=<constraint|tradeoff|disposition|ordering>, got "${s}"` };
    ops.push({ set_type: { ruleId: id, type: parsed.data } });
  }
  return { ops };
}
