import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mockClassification, postProcessClassification } from "../../src/core/agents/classifier";
import { mockDecomposition, postProcessDecomposition } from "../../src/core/agents/decomposer";
import { alignRules, evaluateClassifier, LabelsFile } from "../../src/core/eval/classifierEval";
import type { Rule } from "../../src/core/schemas/records";

const root = path.join(__dirname, "..", "..", "samples");
const harrow = readFileSync(path.join(root, "harrow-vale.md"), "utf8");
const labels = LabelsFile.parse(JSON.parse(readFileSync(path.join(root, "harrow-vale.labels.json"), "utf8")));

function mockRules(policy: string): Rule[] {
  return postProcessDecomposition(policy, mockDecomposition(policy)).rules.map((d, i) => {
    const c = postProcessClassification(mockClassification(d.statement));
    return {
      id: `r${i + 1}`,
      runId: "run",
      index: i + 1,
      statement: d.statement,
      quote: d.quote,
      span: d.span,
      located: d.located,
      section: d.section,
      proposedType: c.type,
      probabilities: c.probabilities,
      confidence: c.confidence,
      rationale: c.rationale,
      ambiguityNote: c.ambiguityNote,
      userType: null,
      parked: c.confidence < 0.7,
      parkedReason: c.confidence < 0.7 ? "low_confidence" : null,
      origin: "extracted",
      parentIds: [],
      coverage: null,
    };
  });
}

describe("classifier evaluation", () => {
  it("every label template quote is locatable in its policy", () => {
    for (const key of ["harrow-vale", "meridian-health", "northgate-it", "campus-customs-hw5", "openai-model-spec-excerpt"]) {
      const policy = readFileSync(path.join(root, `${key}.md`), "utf8");
      const file = LabelsFile.parse(JSON.parse(readFileSync(path.join(root, `${key}.labels.json`), "utf8")));
      expect(alignRules(policy, [], file.rules).unlocatedLabels, key).toEqual([]);
    }
  });

  it("aligns the mock decomposition of Harrow & Vale 13 of 13", () => {
    const report = evaluateClassifier(harrow, mockRules(harrow), labels);
    expect(report.matched).toBe(13);
    expect(report.recall).toBe(1);
    expect(report.precision).toBe(1);
  });

  it("scores ambiguous labels by the flag and low-confidence labels by type or flag", () => {
    const report = evaluateClassifier(harrow, mockRules(harrow), labels);
    const byN = new Map(report.rules.map((r) => [r.n, r]));
    expect(byN.get(9)).toMatchObject({ label: "ambiguous", flagged: true, agree: true });
    expect(byN.get(5)).toMatchObject({ label: "ordering", lowConfidence: true, agree: true });
    // The mock has no special case for "careful professional", so this checks a plain type match.
    expect(byN.get(7)).toMatchObject({ label: "disposition", proposedType: "disposition", agree: true });
    expect(report.thresholds.map((t) => t.threshold)).toEqual([0.6, 0.7, 0.8]);
    expect(report.confusion.ambiguous.flagged).toBe(2);
  });

  it("counts an unmatched label as a miss and an unmatched rule as an extra", () => {
    const rules = mockRules(harrow).filter((r) => r.index !== 2);
    rules.push({ ...rules[0], id: "rX", quote: "Text the policy does not contain at all, about weekend hours.", span: null, located: false });
    const report = evaluateClassifier(harrow, rules, labels);
    expect(report.misses.map((m) => m.n)).toEqual([2]);
    expect(report.extras.map((e) => e.ruleId)).toEqual(["rX"]);
  });
});
