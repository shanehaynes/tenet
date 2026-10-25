import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../../src/cli";

let dir: string;
let output: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "tenet-cli-"));
  process.env.TENET_DATA_DIR = dir;
  output = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    output += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    output += String(chunk);
    return true;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
  delete process.env.TENET_DATA_DIR;
  delete process.env.TENET_PROVIDER;
});

describe("cli", () => {
  it("lists the samples, including the safety demo", async () => {
    expect(await main(["policies", "--provider", "mock"])).toBe(0);
    expect(process.env.TENET_PROVIDER).toBe("mock");
    expect(output).toContain("harrow-vale");
    expect(output).toContain("safety_demo");
  });

  it("reports cumulative spend", async () => {
    expect(await main(["spend"])).toBe(0);
    expect(output).toContain("Cumulative key spend: $0.0000");
  });

  it("run refuses a mistyped --set before analyzing anything", async () => {
    expect(await main(["run", "samples/harrow-vale.md", "--provider", "mock", "--accept-proposed", "--set", "r5=orderng"])).toBe(1);
    expect(output).toContain('--set expects <ruleId>=<constraint|tradeoff|disposition|ordering>, got "r5=orderng"');
    expect(output).not.toContain("analyzing");
  });

  it("rejects unknown commands and options", async () => {
    expect(await main(["nope"])).toBe(1);
    expect(await main(["policies", "--bogus"])).toBe(1);
  });
});
