import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { currentPolicies, ensureSamples, ingestPolicy } from "../../src/core/pipeline/policies";
import { resetModelClient } from "../../src/core/model/client";
import { SAMPLE_CATALOG } from "../../src/core/store/policies";

// A sample file that changes after it was stored (the HW5 excerpt did, on 2026-10-21) must not leave the home
// page with two cards, or Analyze running on the old text.

const root = path.join(__dirname, "..", "..");
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "tenet-samples-"));
  process.env.TENET_DATA_DIR = dir;
  process.env.TENET_PROVIDER = "mock";
  process.env.TENET_SAMPLES_DIR = path.join(root, "samples");
  resetModelClient();
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.TENET_DATA_DIR;
  delete process.env.TENET_PROVIDER;
  delete process.env.TENET_SAMPLES_DIR;
  resetModelClient();
});

describe("sample versions", () => {
  it("stores a changed sample again and offers only the newest version of each sample", async () => {
    const entry = SAMPLE_CATALOG.find((s) => s.key === "northgate-it")!;
    const old = await ingestPolicy({ name: entry.name, text: "You must never reset a password without a ticket.", source: "sample", sample: entry });
    await new Promise((r) => setTimeout(r, 5)); // distinct createdAt
    const all = await ensureSamples();
    const versions = all.filter((p) => p.sample?.key === "northgate-it");
    expect(versions).toHaveLength(2);
    const shown = currentPolicies(all).filter((p) => p.sample?.key === "northgate-it");
    expect(shown).toHaveLength(1);
    expect(shown[0].id).not.toBe(old.id);
    expect(shown[0].text).toContain("Northgate");
    // A second pass changes nothing.
    expect((await ensureSamples()).filter((p) => p.sample?.key === "northgate-it")).toHaveLength(2);
  });
});
