import { describe, expect, it } from "vitest";
import { movedInto } from "../../src/components/statusChange";

describe("movedInto (page redirects)", () => {
  it("redirects when the run reaches the next step while the page is open", () => {
    expect(movedInto("mapping_collisions", "awaiting_collision_review", ["awaiting_collision_review"])).toBe(true);
    expect(movedInto("awaiting_collision_review", "generating", ["generating", "executing", "complete"])).toBe(true);
  });

  it("stays put when the page was opened on a later step, so the stepper can link back", () => {
    expect(movedInto("awaiting_collision_review", "awaiting_collision_review", ["awaiting_collision_review"])).toBe(false);
    expect(movedInto("complete", "complete", ["generating", "executing", "complete"])).toBe(false);
  });

  it("stays put while the run has not reached a target", () => {
    expect(movedInto("classifying", "awaiting_review", ["awaiting_collision_review"])).toBe(false);
  });
});
