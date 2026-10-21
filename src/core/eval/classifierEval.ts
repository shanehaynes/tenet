import { z } from "zod";
import { RULE_TYPES, type RuleType } from "../schemas/agents";
import type { Rule, Span } from "../schemas/records";
import { dice, locate, spanOverlap } from "../text";

// Classifier agreement with hand labels (sample-policies.md §6.3; evidence M03). Pure functions: the script
// supplies the policy text, the run's rules (proposed types before any override) and the labels file.

export const HAND_LABELS = [...RULE_TYPES, "ambiguous"] as const;
export type HandLabel = (typeof HAND_LABELS)[number];

export const LabelsFile = z
  .object({
    policy: z.string(),
    labeler: z.string(),
    labeledAt: z.string().optional(),
    rules: z.array(
      z
        .object({
          n: z.number(),
          quote: z.string(),
          label: z.union([z.enum(HAND_LABELS), z.literal("")]),
          lowConfidence: z.boolean().optional(),
          alternatives: z.array(z.string()).optional(),
          note: z.string().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export type LabelsFile = z.infer<typeof LabelsFile>;
type LabeledRule = LabelsFile["rules"][number];

export type Match = { labeled: LabeledRule; rule: Rule; score: number; how: "span" | "dice" };
export type Alignment = { matches: Match[]; misses: LabeledRule[]; extras: Rule[]; unlocatedLabels: number[] };

/** One-to-one alignment: span overlap ≥ 50 % of the shorter span, else token Dice ≥ 0.6 for unlocated rules. */
export function alignRules(policy: string, rules: Rule[], labels: LabeledRule[]): Alignment {
  const labelSpans = new Map<number, Span | null>();
  const unlocatedLabels: number[] = [];
  for (const l of labels) {
    const hit = locate(policy, l.quote);
    labelSpans.set(l.n, hit?.span ?? null);
    if (!hit) unlocatedLabels.push(l.n);
  }
  const candidates: Match[] = [];
  for (const l of labels) {
    const ls = labelSpans.get(l.n) ?? null;
    for (const r of rules) {
      if (r.span && ls) {
        const overlap = spanOverlap(r.span, ls);
        if (overlap >= 0.5) candidates.push({ labeled: l, rule: r, score: overlap, how: "span" });
      } else {
        const d = dice(r.quote, l.quote);
        if (d >= 0.6) candidates.push({ labeled: l, rule: r, score: d, how: "dice" });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const usedLabels = new Set<number>();
  const usedRules = new Set<string>();
  const matches: Match[] = [];
  for (const c of candidates) {
    if (usedLabels.has(c.labeled.n) || usedRules.has(c.rule.id)) continue;
    usedLabels.add(c.labeled.n);
    usedRules.add(c.rule.id);
    matches.push(c);
  }
  matches.sort((a, b) => a.labeled.n - b.labeled.n);
  return {
    matches,
    misses: labels.filter((l) => !usedLabels.has(l.n)),
    extras: rules.filter((r) => !usedRules.has(r.id)),
    unlocatedLabels,
  };
}

const flaggedAt = (r: Rule, threshold: number) => r.confidence === null || r.confidence < threshold;

function top2(r: Rule): RuleType[] {
  if (!r.probabilities) return r.proposedType ? [r.proposedType] : [];
  return [...RULE_TYPES].sort((a, b) => r.probabilities![b] - r.probabilities![a]).slice(0, 2);
}

export type RuleOutcome = {
  n: number;
  ruleId: string;
  label: HandLabel;
  lowConfidence: boolean;
  proposedType: RuleType | null;
  confidence: number | null;
  flagged: boolean;
  agree: boolean;
  agreeTop2: boolean;
};

export function outcomes(matches: Match[], threshold: number): RuleOutcome[] {
  return matches
    .filter((m) => m.labeled.label !== "")
    .map((m) => {
      const label = m.labeled.label as HandLabel;
      const r = m.rule;
      const flagged = flaggedAt(r, threshold);
      const low = Boolean(m.labeled.lowConfidence);
      let agree: boolean;
      let agreeTop2: boolean;
      if (label === "ambiguous") {
        agree = flagged;
        agreeTop2 = flagged;
      } else {
        agree = r.proposedType === label || (low && flagged);
        agreeTop2 = top2(r).includes(label) || (low && flagged);
      }
      return { n: m.labeled.n, ruleId: r.id, label, lowConfidence: low, proposedType: r.proposedType, confidence: r.confidence, flagged, agree, agreeTop2 };
    });
}

export const CONFUSION_COLUMNS = [...RULE_TYPES, "flagged"] as const;

/** Rows: hand label (including ambiguous). Columns: the classifier's type, or "flagged" below the threshold. */
export function confusionMatrix(rows: RuleOutcome[]): Record<HandLabel, Record<(typeof CONFUSION_COLUMNS)[number], number>> {
  const m = Object.fromEntries(HAND_LABELS.map((l) => [l, Object.fromEntries(CONFUSION_COLUMNS.map((c) => [c, 0]))])) as Record<
    HandLabel,
    Record<(typeof CONFUSION_COLUMNS)[number], number>
  >;
  for (const r of rows) {
    const col = r.flagged || !r.proposedType ? "flagged" : r.proposedType;
    m[r.label][col] += 1;
  }
  return m;
}

export type EvalReport = {
  policy: string;
  labeler: string;
  labeled: number;
  unlabeled: number;
  extracted: number;
  matched: number;
  recall: number;
  precision: number;
  misses: { n: number; quote: string }[];
  extras: { ruleId: string; quote: string }[];
  thresholds: { threshold: number; agree: number; total: number; agreement: number; top2Agreement: number }[];
  primaryThreshold: number;
  rules: RuleOutcome[];
  confusion: ReturnType<typeof confusionMatrix>;
};

export function evaluateClassifier(
  policy: string,
  rules: Rule[],
  labels: LabelsFile,
  opts: { primaryThreshold?: number; thresholds?: number[] } = {},
): EvalReport {
  const primary = opts.primaryThreshold ?? 0.7;
  const thresholds = opts.thresholds ?? [0.6, 0.7, 0.8];
  const a = alignRules(policy, rules, labels.rules);
  const labeled = labels.rules.filter((l) => l.label !== "").length;
  const sweep = thresholds.map((t) => {
    const rows = outcomes(a.matches, t);
    const agree = rows.filter((r) => r.agree).length;
    return {
      threshold: t,
      agree,
      total: rows.length,
      agreement: rows.length ? agree / rows.length : 0,
      top2Agreement: rows.length ? rows.filter((r) => r.agreeTop2).length / rows.length : 0,
    };
  });
  const primaryRows = outcomes(a.matches, primary);
  return {
    policy: labels.policy,
    labeler: labels.labeler,
    labeled,
    unlabeled: labels.rules.length - labeled,
    extracted: rules.length,
    matched: a.matches.length,
    recall: labels.rules.length ? a.matches.length / labels.rules.length : 0,
    precision: rules.length ? a.matches.length / rules.length : 0,
    misses: a.misses.map((l) => ({ n: l.n, quote: l.quote })),
    extras: a.extras.map((r) => ({ ruleId: r.id, quote: r.quote })),
    thresholds: sweep,
    primaryThreshold: primary,
    rules: primaryRows,
    confusion: confusionMatrix(primaryRows),
  };
}

export function reportMarkdown(r: EvalReport): string {
  const pct = (x: number) => `${(100 * x).toFixed(1)} %`;
  const lines = [
    `### Classifier agreement: ${r.policy} (labels by ${r.labeler})`,
    "",
    `Decomposition: ${r.matched} of ${r.labeled + r.unlabeled} labeled rules matched (recall ${pct(r.recall)}); ${r.extracted} extracted (precision ${pct(r.precision)}).`,
    "",
    "| Threshold | Agreement | Top-2 agreement | n |",
    "|---|---|---|---|",
    ...r.thresholds.map((t) => `| ${t.threshold} | ${pct(t.agreement)} | ${pct(t.top2Agreement)} | ${t.total} |`),
    "",
    `Confusion at ${r.primaryThreshold} (rows: hand label; columns: classifier):`,
    "",
    `| | ${CONFUSION_COLUMNS.join(" | ")} |`,
    `|---|${CONFUSION_COLUMNS.map(() => "---").join("|")}|`,
    ...HAND_LABELS.map((l) => `| ${l} | ${CONFUSION_COLUMNS.map((c) => r.confusion[l][c]).join(" | ")} |`),
  ];
  const disagreements = r.rules.filter((x) => !x.agree);
  if (disagreements.length) {
    lines.push("", "Disagreements:", "");
    for (const d of disagreements) {
      lines.push(`- Rule ${d.n} (${d.ruleId}): hand ${d.label}, classifier ${d.proposedType ?? "none"} at ${d.confidence?.toFixed(2) ?? "?"}`);
    }
  }
  if (r.misses.length) lines.push("", `Missed labeled rules: ${r.misses.map((m) => m.n).join(", ")}`);
  return `${lines.join("\n")}\n`;
}
