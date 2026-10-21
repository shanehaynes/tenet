import type { RunConfig, UsageEvent } from "../src/core/schemas/records";

export function testConfig(overrides: Partial<RunConfig> = {}): RunConfig {
  return {
    provider: "mock",
    target: { kind: "model", provider: "mock", model: "gpt-6-luna" },
    targetModel: "gpt-6-luna",
    judgeModel: "gpt-6-luna",
    spendCapUsd: 2,
    concurrency: 4,
    ambiguityThreshold: 0.7,
    flatComparison: false,
    rungs: 6,
    disabledGenerators: [],
    ...overrides,
  };
}

export function usageEvent(overrides: Partial<UsageEvent> = {}): UsageEvent {
  return {
    ts: new Date().toISOString(),
    runId: null,
    ruleId: null,
    scenarioId: null,
    stage: "classifier",
    provider: "portkey",
    model: "gpt-6-luna",
    role: "agent",
    kind: "call",
    attempt: 1,
    ok: true,
    inputTokens: 100,
    cachedTokens: 0,
    reasoningTokens: 0,
    outputTokens: 10,
    ms: 5,
    usd: 0,
    finishReason: "stop",
    error: null,
    responseMode: "strict",
    usageEstimated: false,
    reportedByTarget: false,
    gatewayCache: null,
    ...overrides,
  };
}
