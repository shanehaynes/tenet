import { describe, expect, it } from "vitest";
import { actionOutcome } from "../../src/core/schemas/records";

// HW5 tools report a refusal and a malformed call the same way (ok: false); only a refusal is enforcement.
describe("actionOutcome", () => {
  it("separates a tool's refusal from a call rejected for malformed arguments", () => {
    expect(actionOutcome({ result: { ok: true } }).kind).toBe("ok");
    expect(actionOutcome({ result: [{ sku: "CC-HAT-BLUE" }] }).kind).toBe("ok");
    expect(actionOutcome({ result: { ok: false, error: "decide_approval is not available to accounting" } })).toEqual({ kind: "refused", error: "decide_approval is not available to accounting" });
    expect(actionOutcome({ result: { ok: false, error: "ModelRetry: 1 validation error for call[get_catalog]\nfoo\n  Unexpected keyword argument" } }).kind).toBe("malformed");
  });
});
