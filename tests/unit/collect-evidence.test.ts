import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// Runs scripts/collect-evidence.ts in a temp folder with one classifier evaluation, so it never touches docs/evidence.

const root = path.join(__dirname, "..", "..");
let dir: string | null = null;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe("collect-evidence", () => {
  it("does not list M03 as missing when there is one evaluation round", () => {
    dir = mkdtempSync(path.join(tmpdir(), "tenet-evidence-"));
    const labels = path.join(dir, "docs", "evidence", "labels");
    mkdirSync(labels, { recursive: true });
    const evaluation = {
      evaluatedAt: "2026-10-22T10:00:00.000Z",
      policy: "harrow-vale",
      thresholds: [{ threshold: 0.7, agree: 12, total: 13, agreement: 12 / 13 }],
      primaryThreshold: 0.7,
      recall: 1,
      precision: 1,
    };
    writeFileSync(path.join(labels, "eval-harrow-vale-run1.json"), JSON.stringify(evaluation));
    execFileSync(path.join(root, "node_modules", ".bin", "tsx"), [path.join(root, "scripts", "collect-evidence.ts")], {
      cwd: dir,
      env: { ...process.env, TENET_DATA_DIR: path.join(dir, "data") },
      stdio: "pipe",
    });
    const out = JSON.parse(readFileSync(path.join(dir, "docs", "evidence", "report-data.json"), "utf8"));
    expect(out.values["M03.pooled"].value).toBe("92.3 % (12/13)");
    expect(out.values["M03.rounds"]).toBeUndefined();
    expect(out.missing.map((m: { measurement: string }) => m.measurement)).not.toContain("M03");
  });
});
