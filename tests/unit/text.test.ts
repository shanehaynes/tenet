import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { newId, scenarioId } from "../../src/core/ids";
import { dice, locate, normalize, sectionAt, spanOverlap, verifyQuote } from "../../src/core/text";

const harrow = readFileSync(path.join(__dirname, "..", "..", "samples", "harrow-vale.md"), "utf8");

describe("ids", () => {
  it("makes 10-character base62 ids that do not collide", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(id).toMatch(/^[0-9A-Za-z]{10}$/);
  });
  it("names scenarios after their test", () => {
    expect(scenarioId("r2", "ladder", 5)).toBe("r2-L5");
    expect(scenarioId("c1", "conflict", 1)).toBe("c1-C1");
  });
});

describe("normalize", () => {
  it("straightens quotes and dashes, drops emphasis, collapses whitespace, lowercases", () => {
    expect(normalize("  The firm’s  **“rule”** — `here`\n now ")).toBe('the firm\'s "rule" - here now');
  });
});

describe("locate", () => {
  it("finds an exact quote", () => {
    const q = "Never disclose one client's information to another client or any third party.";
    const hit = locate(harrow, q)!;
    expect(hit.method).toBe("exact");
    expect(harrow.slice(hit.span.start, hit.span.end)).toBe(q);
  });

  it("maps a normalized match back to the original span", () => {
    const q = "protect the firm’s   REPUTATION.";
    const hit = locate(harrow, q)!;
    expect(hit.method).toBe("normalized");
    expect(harrow.slice(hit.span.start, hit.span.end)).toBe("Protect the firm's reputation.");
  });

  it("accepts a close paraphrase by token Dice and rejects an unrelated sentence", () => {
    const hit = locate(harrow, "Weigh client convenience against the identity-fraud risk when releasing documents")!;
    expect(hit.method).toBe("fuzzy");
    expect(hit.score).toBeGreaterThanOrEqual(0.8);
    expect(harrow.slice(hit.span.start, hit.span.end)).toContain("identity-fraud risk");
    expect(locate(harrow, "Always offer clients a free consultation every spring")).toBeNull();
  });

  it("strips markdown emphasis when matching", () => {
    const md = "4. **Payments and purchases need human approval.** No agent pays anything.";
    const hit = locate(md, "Payments and purchases need human approval. No agent pays anything.")!;
    expect(hit.method).toBe("normalized");
    expect(md.slice(hit.span.start, hit.span.end)).toBe("Payments and purchases need human approval.** No agent pays anything.");
  });
});

describe("helpers", () => {
  it("dice is 1 for identical token sets and 0 for disjoint ones", () => {
    expect(dice("a b c", "c b a")).toBe(1);
    expect(dice("a b", "c d")).toBe(0);
  });
  it("spanOverlap is relative to the shorter span", () => {
    expect(spanOverlap({ start: 0, end: 10 }, { start: 5, end: 30 })).toBe(0.5);
    expect(spanOverlap({ start: 0, end: 5 }, { start: 5, end: 9 })).toBe(0);
  });
  it("verifyQuote ignores case, quote style and trailing punctuation", () => {
    const reply = "I can’t submit that without the partner's approval. I can draft it for review.";
    expect(verifyQuote(reply, "I can't submit that without the partner’s approval")).toBe(true);
    expect(verifyQuote(reply, "I have submitted it.")).toBe(false);
    expect(verifyQuote(reply, null)).toBe(false);
  });
  it("sectionAt returns the governing heading", () => {
    const at = harrow.indexOf("Avoid harm to clients.");
    expect(sectionAt(harrow, at)).toBe("Conduct with clients");
  });
});
