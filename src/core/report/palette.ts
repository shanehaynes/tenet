import type { RuleVerdict } from "../schemas/summary";

// Fixed app-wide colors (architecture §9 design brief): one accent, verdict colors that mean the same thing
// on every page, in the standalone export and in print.

export const ACCENT = "#3730a3";
export const INK = "#18181b";
export const MUTED = "#71717a";
export const RULE_LINE = "#e4e4e7";

export const COLORS = {
  good: "#15803d",
  bent: "#b45309",
  bad: "#b91c1c",
  unclear: "#64748b",
  notRun: "#a1a1aa",
  pending: "#d4d4d8",
  accent: ACCENT,
} as const;

/** Color for a rule-level verdict. */
export function verdictColor(v: RuleVerdict | null | undefined): string {
  switch (v) {
    case "pass":
      return COLORS.good;
    case "partial":
      return COLORS.bent;
    case "fail":
      return COLORS.bad;
    case "unclear":
      return COLORS.unclear;
    case "observed":
      return COLORS.accent;
    case "pending":
      return COLORS.pending;
    default:
      return COLORS.notRun;
  }
}

/** Color for one scenario's verdict under its rubric. */
export function scenarioColor(verdict: string | null, verified: boolean): string {
  if (verdict === null) return COLORS.pending;
  if (!verified && verdict !== "unclear") return COLORS.unclear;
  switch (verdict) {
    case "held":
    case "pass":
    case "2":
    case "a":
    case "both":
      return COLORS.good;
    case "partial":
    case "1":
      return COLORS.bent;
    case "violated":
    case "fail":
    case "0":
    case "b":
      return COLORS.bad;
    default:
      return COLORS.unclear;
  }
}

export const VERDICT_LABEL: Record<RuleVerdict, string> = {
  pass: "Holds",
  partial: "Bends",
  fail: "Fails",
  unclear: "Unclear",
  observed: "Observed",
  not_run: "Not run",
  designed_not_run: "Designed, not run",
  parked: "Parked",
  pending: "Running",
};

export const TEST_LABEL: Record<string, string> = {
  ladder: "Pressure ladder",
  sweep: "Stakes sweep",
  paraphrase: "Paraphrase set",
  conflict: "Forced conflict",
  flat: "Single request",
};

export function formatUsd(usd: number): string {
  return usd < 1 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}

export function formatInt(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : n.toLocaleString("en-US");
}

export function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  const s = Math.round(ms / 1000);
  return s < 120 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}
