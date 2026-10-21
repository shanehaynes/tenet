import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildExecutorSystemPrompt, inferIdentity } from "../../src/core/agents/executorPrompt";
import { estimateTokens } from "../../src/core/model/providers/mock";

// OpenAI caches only prefixes of 1,024+ identical tokens. Every static system prompt must clear 1,100
// estimated tokens (chars ÷ 4) on the demo policy, or caching will never show in the tokenomics section.
// Each agent adds its prefix here as it is built (architecture §4.4).

const PREFIX_FLOOR = 1100;
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
