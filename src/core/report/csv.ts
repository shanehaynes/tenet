import type { UsageEvent } from "../schemas/records";

// CSV export of a run's usage log (PRD Req. 11; architecture §8).

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: (keyof T & string)[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

export const USAGE_COLUMNS: (keyof UsageEvent & string)[] = [
  "ts",
  "stage",
  "ruleId",
  "scenarioId",
  "provider",
  "model",
  "kind",
  "attempt",
  "ok",
  "inputTokens",
  "cachedTokens",
  "reasoningTokens",
  "outputTokens",
  "ms",
  "usd",
  "finishReason",
  "responseMode",
  "usageEstimated",
  "reportedByTarget",
  "gatewayCache",
  "error",
];

export function usageCsv(events: UsageEvent[]): string {
  return toCsv(events as unknown as Record<string, unknown>[], USAGE_COLUMNS);
}
