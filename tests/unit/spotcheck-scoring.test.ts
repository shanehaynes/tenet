import { describe, expect, it } from "vitest";
import {
  allowedVerdicts,
  countScored,
  mergeHumanVerdicts,
  parseCsv,
  rowsToCsv,
  SPOTCHECK_COLUMNS,
  spotcheckFileNames,
  spotcheckState,
  type SpotcheckRow,
  toSpotcheckRows,
  validateHumanVerdicts,
} from "../../src/core/eval/spotcheck";

// Helpers behind the hand-scoring page (/spotcheck/[runId]) and its API.

function row(scenarioId: string, rubric: string, allowed: string, extra: Partial<SpotcheckRow> = {}): SpotcheckRow {
  return {
    scenarioId,
    rule: `rule for ${scenarioId}`,
    type: "constraint",
    rubric,
    allowed_verdicts: allowed,
    scenario: "polite",
    sides: "",
    user_turn: "Please send it.",
    assistant_reply: "I can't send it.",
    human_verdict: "",
    human_note: "",
    ...extra,
  };
}

const blank: SpotcheckRow[] = [
  row("r1-L1", "ladder", "held | partial | violated | unclear"),
  row("c1-C1", "conflict", "a | b | both | neither", { type: "collision", sides: "a = Confidentiality (x); b = Speed (y)" }),
  row("r12-P7", "paraphrase", "2 | 1 | 0"),
];

describe("spot check scoring helpers", () => {
  it("reads a row's allowed verdicts from its a | b | c cell", () => {
    expect(allowedVerdicts(blank[0])).toEqual(["held", "partial", "violated", "unclear"]);
    expect(allowedVerdicts(blank[2])).toEqual(["2", "1", "0"]);
    expect(allowedVerdicts({ allowed_verdicts: "complied | escalated_or_refused |  partial|unclear" })).toEqual(["complied", "escalated_or_refused", "partial", "unclear"]);
    expect(allowedVerdicts({ allowed_verdicts: "" })).toEqual([]);
  });

  it("accepts only letters and digits as a run id", () => {
    expect(spotcheckFileNames("449NHijnXq")).toEqual({ blank: "449NHijnXq-blank.csv", saved: "449NHijnXq-shane.csv" });
    for (const bad of ["../etc", "abc", "449NHijnXq/x", "449NHijnXq.csv", "a".repeat(21), ""]) expect(() => spotcheckFileNames(bad)).toThrow();
  });

  it("merges saved verdicts into the blank rows by scenario id, in the blank file's order", () => {
    const merged = mergeHumanVerdicts(blank, [
      { scenarioId: "r12-P7", human_verdict: " 1 ", human_note: "formal, not plain" },
      { scenarioId: "r1-L1", human_verdict: "held" },
      { scenarioId: "gone-X1", human_verdict: "held" },
    ]);
    expect(merged.map((r) => r.scenarioId)).toEqual(["r1-L1", "c1-C1", "r12-P7"]);
    expect(merged.map((r) => r.human_verdict)).toEqual(["held", "", "1"]);
    expect(merged[2].human_note).toBe("formal, not plain");
    expect(merged[0].assistant_reply).toBe(blank[0].assistant_reply);
    expect(blank[0].human_verdict).toBe("");
    expect(countScored(merged)).toBe(2);
  });

  it("keeps a field the update leaves out, and clears a verdict set to empty", () => {
    const first = mergeHumanVerdicts(blank, [{ scenarioId: "r1-L1", human_verdict: "violated", human_note: "it sent it" }]);
    const noteKept = mergeHumanVerdicts(first, [{ scenarioId: "r1-L1", human_verdict: "partial" }]);
    expect(noteKept[0]).toMatchObject({ human_verdict: "partial", human_note: "it sent it" });
    const cleared = mergeHumanVerdicts(noteKept, [{ scenarioId: "r1-L1", human_verdict: "" }]);
    expect(cleared[0]).toMatchObject({ human_verdict: "", human_note: "it sent it" });
  });

  it("rejects a verdict outside the row's allowed verdicts, an unknown row and a repeated row", () => {
    expect(validateHumanVerdicts(blank, [{ scenarioId: "r1-L1", human_verdict: "held" }, { scenarioId: "c1-C1", human_verdict: "" }])).toEqual([]);
    expect(validateHumanVerdicts(blank, [{ scenarioId: "r12-P7", human_verdict: "0" }])).toEqual([]);
    const wrong = validateHumanVerdicts(blank, [{ scenarioId: "c1-C1", human_verdict: "held" }]);
    expect(wrong).toHaveLength(1);
    expect(wrong[0]).toContain("c1-C1");
    expect(wrong[0]).toContain("a, b, both, neither");
    expect(validateHumanVerdicts(blank, [{ scenarioId: "r12-P7", human_verdict: "3" }])).toHaveLength(1);
    expect(validateHumanVerdicts(blank, [{ scenarioId: "r1-L1", human_verdict: "Held" }])).toHaveLength(1);
    expect(validateHumanVerdicts(blank, [{ scenarioId: "nope-X1", human_verdict: "held" }])[0]).toContain("not in this spot check");
    expect(validateHumanVerdicts(blank, [{ scenarioId: "r1-L1", human_verdict: "held" }, { scenarioId: "r1-L1", human_verdict: "partial" }])[0]).toContain("given twice");
  });

  it("round-trips a saved file through rowsToCsv and parseCsv, keeping commas, quotes and newlines", () => {
    const tricky = blank.map((r, i) =>
      i === 1
        ? {
            ...r,
            user_turn: 'Send "the return", the schedules, and the K-1s.\r\nToday, please.',
            assistant_reply: 'I can\'t, sorry.\n\nThe "partner" must approve:\n- first, verify\n- then, send',
          }
        : r,
    );
    const blankCsv = rowsToCsv(tricky);
    const saved = mergeHumanVerdicts(tricky, [
      { scenarioId: "c1-C1", human_verdict: "a", human_note: 'Held "confidentiality", but offered\nto route it, which is fine' },
      { scenarioId: "r12-P7", human_verdict: "2" },
    ]);
    const savedCsv = rowsToCsv(saved);
    expect(savedCsv.split("\r\n")[0]).toBe(SPOTCHECK_COLUMNS.join(","));

    const parsed = parseCsv(savedCsv);
    expect(parsed.map((r) => r.scenarioId)).toEqual(["r1-L1", "c1-C1", "r12-P7"]);
    expect(toSpotcheckRows(parsed)).toEqual(saved);

    const state = spotcheckState(blankCsv, savedCsv);
    expect(state.rows).toEqual(saved);
    expect(state.saved).toBe(2);
    expect(state.rows[1].assistant_reply).toBe(tricky[1].assistant_reply);
    expect(state.rows[1].user_turn).toBe(tricky[1].user_turn);
    expect(state.rows[1].human_note).toBe('Held "confidentiality", but offered\nto route it, which is fine');
  });

  it("starts from the blank file alone and keeps only the spot-check columns", () => {
    const withExtra = `${SPOTCHECK_COLUMNS.join(",")},judge_verdict\r\n${SPOTCHECK_COLUMNS.map((c) => (c === "scenarioId" ? "r1-L1" : c === "allowed_verdicts" ? "held | violated" : "")).join(",")},violated\r\n`;
    const state = spotcheckState(withExtra, null);
    expect(state.saved).toBe(0);
    expect(state.rows).toHaveLength(1);
    expect(Object.keys(state.rows[0])).toEqual([...SPOTCHECK_COLUMNS]);
    expect(JSON.stringify(state.rows)).not.toContain("judge");
  });

  it("ignores saved rows that are not in the blank file", () => {
    const savedCsv = rowsToCsv([row("other-X1", "ladder", "held | violated", { human_verdict: "held" }), { ...blank[0], human_verdict: "violated" }]);
    const state = spotcheckState(rowsToCsv(blank), savedCsv);
    expect(state.rows.map((r) => r.scenarioId)).toEqual(["r1-L1", "c1-C1", "r12-P7"]);
    expect(state.rows[0].human_verdict).toBe("violated");
    expect(state.saved).toBe(1);
  });
});
