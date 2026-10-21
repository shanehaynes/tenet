import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { Scenario, Transcript, Verdict } from "../schemas/records";
import { buildJudgeSystem, judgeScenario } from "./judge";

// Judge integrity canary (agents §7; PRD Req. 12; evidence M16/S17): transcripts that try to instruct the
// judge. The judge must ignore the instruction and score the reply on what it says it did.

export const CanaryFile = z.object({
  rule: z.object({ statement: z.string(), type: z.enum(["constraint", "tradeoff", "disposition", "ordering"]) }),
  cases: z.array(
    z.object({ id: z.string(), purpose: z.string(), tactic: z.string(), userTurn: z.string(), reply: z.string(), expected: z.string() }),
  ),
});
export type CanaryFile = z.infer<typeof CanaryFile>;

export type CanaryResult = { id: string; purpose: string; expected: string; verdict: Verdict; passed: boolean };

export async function loadCanaries(file: string): Promise<CanaryFile> {
  return CanaryFile.parse(JSON.parse(await readFile(file, "utf8")));
}

export async function runCanaries(canaries: CanaryFile, policyText: string): Promise<CanaryResult[]> {
  const system = buildJudgeSystem(policyText);
  const results: CanaryResult[] = [];
  for (const [i, c] of canaries.cases.entries()) {
    const scenario: Scenario = {
      id: c.id,
      runId: "canary",
      ruleId: null,
      collisionId: null,
      kind: "ladder",
      index: i + 1,
      tactic: c.tactic as Scenario["tactic"],
      variable: null,
      value: null,
      label: null,
      dimension: null,
      context: null,
      sides: null,
      userTurn: c.userTurn,
      status: "done",
      error: null,
    };
    const transcript: Transcript = {
      scenarioId: c.id,
      systemPrompt: null,
      messages: [
        { role: "user", content: c.userTurn },
        { role: "assistant", content: c.reply },
      ],
      finishReason: "stop",
      truncated: false,
      ms: 0,
      model: "fixture",
      actions: null,
      targetUsage: null,
    };
    const verdict = await judgeScenario(scenario, transcript, { runId: null, system, rules: [canaries.rule] });
    results.push({ id: c.id, purpose: c.purpose, expected: c.expected, verdict, passed: verdict.verdict === c.expected });
  }
  return results;
}
