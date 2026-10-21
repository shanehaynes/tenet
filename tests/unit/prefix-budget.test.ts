import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildExecutorSystemPrompt, inferIdentity } from "../../src/core/agents/executorPrompt";
import { estimateTokens, PREFIX_TOKEN_FLOOR } from "../../src/core/model/tokens";

// OpenAI caches only prefixes of 1,024+ identical tokens. Every static system prompt must clear the floor
// (calibrated estimate, src/core/model/tokens.ts) on the demo policy, or caching will never show in the
// tokenomics section. Each agent adds its prefix here as it is built (architecture §4.4).

const PREFIX_FLOOR = PREFIX_TOKEN_FLOOR;
const harrow = readFileSync(path.join(__dirname, "..", "..", "samples", "harrow-vale.md"), "utf8");

describe("static prefix budget", () => {
  it("executor: preamble + Harrow & Vale", () => {
    expect(estimateTokens(buildExecutorSystemPrompt(harrow))).toBeGreaterThanOrEqual(PREFIX_FLOOR);
  });

  it("executor identity comes from the policy title", () => {
    expect(inferIdentity(harrow)).toEqual({ organization: "Harrow & Vale LLP", role: "client-service assistant" });
    expect(inferIdentity("no headings here").organization).toBe("the organization");
  });
});

import { buildJudgeSystem } from "../../src/core/agents/judge";
import { buildGeneratorSystem } from "../../src/core/agents/generators/shared";
import { ladderRubric } from "../../src/core/agents/generators/ladder";
import { SWEEP_RUBRIC } from "../../src/core/agents/generators/sweep";
import { PARAPHRASE_RUBRIC } from "../../src/core/agents/generators/paraphrase";
import { CONFLICT_RUBRIC } from "../../src/core/agents/generators/conflict";

describe("static prefix budget: judge and generators", () => {
  const target = { kind: "model" as const, provider: "mock" as const, model: "gpt-6-luna" };
  it("judge: persona + policy + glossary + rubrics", () => {
    expect(estimateTokens(buildJudgeSystem(harrow))).toBeGreaterThanOrEqual(PREFIX_FLOOR);
  });
  it.each([
    ["ladder", ladderRubric(6)],
    ["ladder (4 rungs)", ladderRubric(4)],
    ["sweep", SWEEP_RUBRIC],
    ["paraphrase", PARAPHRASE_RUBRIC],
    ["conflict", CONFLICT_RUBRIC],
  ])("generator: %s", (_name, rubric) => {
    expect(estimateTokens(buildGeneratorSystem(rubric, harrow, target))).toBeGreaterThanOrEqual(PREFIX_FLOOR);
  });
});
