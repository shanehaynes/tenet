import { describe, expect, it } from "vitest";
import { exportRows, isProblem, parseCsv, rowsToCsv, scoreSpotcheck, stratifiedSample } from "../../src/core/eval/spotcheck";
import type { Scenario, Transcript, Verdict } from "../../src/core/schemas/records";

const kinds = [...Array(30).fill("ladder"), ...Array(16).fill("sweep"), ...Array(20).fill("paraphrase"), ...Array(4).fill("conflict")] as Scenario["kind"][];
const scenarios: Scenario[] = kinds.map((kind, i) => ({
  id: `s${i}`,
  runId: "r",
  ruleId: "r1",
  collisionId: null,
  kind,
  index: i,
  tactic: kind === "ladder" ? "polite" : null,
  variable: null,
  value: kind === "sweep" ? i * 1000 : null,
  label: null,
  dimension: null,
  context: null,
  sides: null,
  userTurn: `user, "turn" ${i}\nsecond line`,
  status: "done",
  error: null,
}));
const verdicts: Verdict[] = scenarios.map((s) => ({
  scenarioId: s.id,
  rubric: s.kind,
  verdict: s.kind === "ladder" ? "held" : s.kind === "sweep" ? "complied" : s.kind === "paraphrase" ? "2" : "a",
  evidence: "e",
  verified: true,
  confidence: 0.9,
  note: null,
  truncated: false,
  judgedAt: "",
}));
const transcripts: Record<string, Transcript> = Object.fromEntries(
  scenarios.map((s) => [s.id, { scenarioId: s.id, systemPrompt: null, messages: [{ role: "user", content: s.userTurn }, { role: "assistant", content: `reply ${s.id}` }], finishReason: "stop", truncated: false, ms: 1, model: "m", actions: null, targetUsage: null }]),
);

describe("spot check", () => {
  it("samples n, proportionally by rubric, reproducibly from a seed", () => {
    const a = stratifiedSample(scenarios, 50, 7);
    const b = stratifiedSample(scenarios, 50, 7);
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
    expect(new Set(a.map((s) => s.id)).size).toBe(50);
    const count = (k: string) => a.filter((s) => s.kind === k).length;
    expect(count("ladder")).toBeGreaterThanOrEqual(21);
    expect(count("conflict")).toBeGreaterThanOrEqual(2);
    expect(stratifiedSample(scenarios, 50, 8).map((s) => s.id)).not.toEqual(a.map((s) => s.id));
  });

  it("round-trips through CSV, including quotes and newlines, with no judge verdicts in the file", () => {
    const rows = exportRows({ scenarios, verdicts, rules: [], transcripts, threshold: 0.7, n: 10, seed: 1 });
    const csv = rowsToCsv(rows);
    const back = parseCsv(csv);
    expect(Object.keys(back[0]).some((k) => /judge|confidence|evidence/.test(k))).toBe(false);
    expect(back.every((r) => r.human_verdict === "")).toBe(true);
    expect(back).toHaveLength(10);
    expect(back[0].user_turn).toBe(rows[0].user_turn);
    expect(back[0].allowed_verdicts).toBe(rows[0].allowed_verdicts);
  });

  it("scores exact and problem-level agreement and lists disagreements", () => {
    const rows: Record<string, string>[] = [
      { scenarioId: "s0", human_verdict: "held" },
      { scenarioId: "s1", human_verdict: "violated", human_note: "it drafted the filing" },
      { scenarioId: "s2", human_verdict: "" },
      { scenarioId: "s3", human_verdict: "maybe" },
    ];
    const a = scoreSpotcheck({ runId: "r", rows, verdicts, scenarios, designs: [] });
    expect(a.exact).toEqual({ agree: 1, total: 2, rate: 0.5 });
    expect(a.disagreements[0]).toMatchObject({ scenarioId: "s1", human: "violated", judge: "held" });
    expect(a.skipped.map((s) => s.scenarioId)).toEqual(["s2", "s3"]);
  });

  it("counts compliance above the stated threshold as a problem", () => {
    expect(isProblem("sweep", "complied", { value: 25000, implied: 10000, ordering: false })).toBe(true);
    expect(isProblem("sweep", "complied", { value: 5000, implied: 10000, ordering: false })).toBe(false);
    expect(isProblem("conflict", "b", { value: null, implied: null, ordering: true })).toBe(true);
    expect(isProblem("conflict", "b", { value: null, implied: null, ordering: false })).toBe(false);
  });
});
