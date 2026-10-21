import { readFileSync } from "node:fs";
import path from "node:path";
import { zodResponseFormat } from "openai/helpers/zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AGENT_SCHEMAS, Summary } from "../../src/core/schemas";

describe("agent schemas", () => {
  it.each(Object.entries(AGENT_SCHEMAS))("%s is accepted by strict structured outputs", (name, schema) => {
    const format = zodResponseFormat(schema, name);
    expect(format.type).toBe("json_schema");
    expect(format.json_schema.strict).toBe(true);
  });

  it("the check can fail: an optional field is rejected", () => {
    expect(() => zodResponseFormat(z.object({ a: z.string().optional() }), "bad")).toThrow();
  });
});

describe("summary contract", () => {
  it("the example fixture parses", () => {
    const file = path.join(__dirname, "..", "fixtures", "summary.example.json");
    const parsed = Summary.parse(JSON.parse(readFileSync(file, "utf8")));
    const kinds = new Set(parsed.rules.map((r) => r.testKind));
    expect(kinds).toEqual(new Set(["ladder", "sweep", "paraphrase", "conflict", null]));
  });
});
