import { describe, expect, it } from "vitest";

describe("toolchain", () => {
  it("runs on Node 22.12 or newer", () => {
    const [major, minor] = process.versions.node.split(".").map(Number);
    expect(major > 22 || (major === 22 && minor >= 12)).toBe(true);
  });
});
