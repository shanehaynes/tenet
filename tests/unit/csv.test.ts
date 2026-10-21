import { describe, expect, it } from "vitest";
import { csvCell, toCsv, usageCsv } from "../../src/core/report/csv";
import { usageEvent } from "../helpers";

describe("csv", () => {
  it("quotes commas, quotes and newlines; leaves nulls empty", () => {
    expect(csvCell('say "hi", then\nleave')).toBe('"say ""hi"", then\nleave"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(0.0042)).toBe("0.0042");
    expect(toCsv([{ a: 1, b: "x,y" }], ["a", "b"])).toBe('a,b\r\n1,"x,y"\r\n');
  });
  it("writes one row per usage event with a fixed header", () => {
    const csv = usageCsv([usageEvent({ stage: "judge", usd: 0.001, cachedTokens: null })]);
    const [header, row] = csv.trim().split("\r\n");
    expect(header.split(",").slice(0, 4)).toEqual(["ts", "stage", "ruleId", "scenarioId"]);
    expect(row).toContain(",judge,");
  });
});
