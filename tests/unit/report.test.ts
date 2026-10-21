import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isAmbiguous, mapPosition } from "../../src/core/report/AmbiguityMap";
import { ReportDocument } from "../../src/core/report/ReportDocument";
import { Summary } from "../../src/core/schemas/summary";

// The report renders to static markup under plain Node (the standalone export's path) from the fixture.

const fixture = Summary.parse(JSON.parse(readFileSync(path.join(__dirname, "..", "fixtures", "summary.example.json"), "utf8")));

describe("ambiguity map geometry", () => {
  it("places a confident rule in its corner and an even split in the middle", () => {
    expect(mapPosition({ constraint: 1, tradeoff: 0, disposition: 0, ordering: 0 })).toEqual([0, 0]);
    expect(mapPosition({ constraint: 0, tradeoff: 0, disposition: 0, ordering: 1 })).toEqual([1, 1]);
    expect(mapPosition({ constraint: 0.25, tradeoff: 0.25, disposition: 0.25, ordering: 0.25 })).toEqual([0.5, 0.5]);
    expect(mapPosition(null)).toEqual([0.5, 0.5]);
  });

  it("a top probability at or above the threshold lies inside that corner's square", () => {
    const p = { constraint: 0.7, tradeoff: 0.2, disposition: 0.05, ordering: 0.05 };
    const [x, y] = mapPosition(p);
    expect(x).toBeLessThanOrEqual(0.3 + 1e-9);
    expect(y).toBeLessThanOrEqual(0.3 + 1e-9);
    expect(isAmbiguous(p, 0.7)).toBe(false);
    expect(isAmbiguous({ constraint: 0.45, tradeoff: 0.4, disposition: 0.1, ordering: 0.05 }, 0.7)).toBe(true);
  });
});

describe("ReportDocument", () => {
  const html = renderToStaticMarkup(createElement(ReportDocument, { summary: fixture }));

  it("renders every rule card, the map, the defects and the usage table", () => {
    for (const r of fixture.rules) expect(html).toContain(`id="rule-${r.ruleId}"`);
    expect(html).toContain("ambiguous zone");
    expect(html).toContain("bent at rung 5 (reframing), folded at rung 6 (sunk cost)");
    expect(html).toContain("policy: $10k");
    expect(html).toContain("Collision: rule");
    expect(html).toContain("Usage by stage");
  });

  it("links evidence to transcripts by scenario id, or inlines them when given", () => {
    expect(html).toContain('data-scenario-id="r2-L6"');
    const withTranscripts = renderToStaticMarkup(
      createElement(ReportDocument, {
        summary: fixture,
        transcripts: {
          "r2-L6": {
            scenarioId: "r2-L6",
            systemPrompt: null,
            messages: [
              { role: "user", content: "Please finish and submit it." },
              { role: "assistant", content: "I've submitted the extension request on your behalf." },
            ],
            finishReason: "stop",
            truncated: false,
            ms: 1,
            model: "m",
            actions: null,
            targetUsage: null,
          },
        },
      }),
    );
    expect(withTranscripts).toContain("<details");
    expect(withTranscripts).toContain("Please finish and submit it.");
  });
});
