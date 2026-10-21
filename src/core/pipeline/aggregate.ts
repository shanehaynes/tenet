import type { Run, Stage, UsageEvent } from "../schemas/records";
import { STAGES } from "../schemas/records";
import type { Summary } from "../schemas/summary";
import { totalsFromUsage } from "../store/usage";

// Aggregation (agents-and-prompts.md §9). Thursday adds buildSummary for full runs; Wednesday needs only the
// "no testable rules" result and the usage-by-stage table both share.

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function usageByStage(events: UsageEvent[]): Summary["usageByStage"] {
  const rows: Summary["usageByStage"] = [];
  for (const stage of STAGES as readonly Stage[]) {
    const es = events.filter((e) => e.stage === stage);
    if (!es.length) continue;
    const t = totalsFromUsage(es);
    rows.push({
      stage,
      calls: t.calls,
      inputTokens: t.inputTokens,
      cachedTokens: t.cachedTokens,
      reasoningTokens: t.reasoningTokens,
      outputTokens: t.outputTokens,
      usd: t.usd,
      medianMs: median(es.filter((e) => e.ok && !e.reportedByTarget).map((e) => e.ms)),
    });
  }
  return rows;
}

export function buildNoRulesSummary(run: Run, events: UsageEvent[]): Summary {
  const t = totalsFromUsage(events);
  return {
    runId: run.id,
    policyId: run.policyId,
    policyName: run.policyName,
    kind: "no_testable_rules",
    partial: false,
    generatedAt: new Date().toISOString(),
    strip: {
      rulesTotal: 0,
      rulesTested: 0,
      rulesP1NotRun: 0,
      rulesParked: {},
      failures: 0,
      partials: 0,
      ambiguities: 0,
      collisions: 0,
      scenariosTotal: 0,
      scenariosNotRun: 0,
      unverifiedCount: 0,
      truncatedCount: 0,
      calls: t.calls,
      inputTokens: t.inputTokens,
      cachedTokens: t.cachedTokens,
      reasoningTokens: t.reasoningTokens,
      outputTokens: t.outputTokens,
      usd: t.usd,
      analysisUsd: t.analysisUsd,
      testUsd: t.testUsd,
      wallClockMs: run.wallClockMs,
    },
    rules: [],
    map: { threshold: run.config.ambiguityThreshold, arcs: [] },
    defects: { ambiguities: [], collisions: [] },
    untestablePassages: run.untestablePassages,
    typedVsFlat: null,
    usageByStage: usageByStage(events),
    planted: null,
    config: { ...run.config, modelString: run.config.targetModel, capabilities: null },
  };
}
