import { appendFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readJson, readJsonl, writeJsonAtomic, appendJsonl } from "../../src/core/store/fs";
import { appendEvent, createRun, listRuns, readEvents, readRun, readRunFile, withRun } from "../../src/core/store/runs";
import { appendUsage, keySpend } from "../../src/core/store/usage";
import { testConfig, usageEvent } from "../helpers";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "tenet-store-"));
  process.env.TENET_DATA_DIR = dir;
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.TENET_DATA_DIR;
});

describe("fs", () => {
  it("50 concurrent atomic writes leave a parseable file and no temp files", async () => {
    const file = path.join(dir, "x", "value.json");
    await Promise.all(Array.from({ length: 50 }, (_, i) => writeJsonAtomic(file, { i, pad: "y".repeat(2000) })));
    const value = await readJson<{ i: number }>(file);
    expect(value?.i).toBeGreaterThanOrEqual(0);
    expect(readdirSync(path.dirname(file)).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("100 concurrent appends all parse, and a torn last line is skipped", async () => {
    const file = path.join(dir, "log.jsonl");
    await Promise.all(Array.from({ length: 100 }, (_, i) => appendJsonl(file, { i })));
    appendFileSync(file, '{"i": 10');
    const rows = await readJsonl<{ i: number }>(file);
    expect(rows).toHaveLength(100);
    expect(new Set(rows.map((r) => r.i)).size).toBe(100);
  });
});

describe("runs", () => {
  it("20 concurrent withRun increments all land", async () => {
    const run = await createRun({ policyId: "p1", policyName: "Policy", config: testConfig() });
    await Promise.all(
      Array.from({ length: 20 }, () =>
        withRun(run.id, async (tx) => {
          const r = await tx.get("run");
          await new Promise((res) => setTimeout(res, 1));
          tx.set("run", { ...r, nextRuleNumber: r.nextRuleNumber + 1 });
        }),
      ),
    );
    expect((await readRun(run.id)).nextRuleNumber).toBe(21);
  });

  it("a throwing mutation writes nothing and does not block the next one", async () => {
    const run = await createRun({ policyId: "p1", policyName: "Policy", config: testConfig() });
    await expect(
      withRun(run.id, async (tx) => {
        const r = await tx.get("run");
        tx.set("run", { ...r, status: "failed" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect((await readRun(run.id)).status).toBe("created");
    await withRun(run.id, async (tx) => tx.set("rules", []));
    expect(await readRunFile(run.id, "rules")).toEqual([]);
  });

  it("lists runs newest first and appends events", async () => {
    const a = await createRun({ policyId: "p1", policyName: "A", config: testConfig() });
    await new Promise((r) => setTimeout(r, 5));
    const b = await createRun({ policyId: "p2", policyName: "B", config: testConfig() });
    expect((await listRuns()).map((r) => r.id)).toEqual([b.id, a.id]);
    await appendEvent(a.id, { stage: "decomposer", message: "13 rules" });
    expect((await readEvents(a.id))[0].message).toBe("13 rules");
  });

  it("lists runs past a stray file in the runs folder", async () => {
    const a = await createRun({ policyId: "p1", policyName: "A", config: testConfig() });
    writeFileSync(path.join(dir, "runs", ".DS_Store"), "");
    expect((await listRuns()).map((r) => r.id)).toEqual([a.id]);
  });
});

describe("usage", () => {
  it("logs per run and globally; key spend counts billed providers and target-reported usage only", async () => {
    const run = await createRun({ policyId: "p1", policyName: "Policy", config: testConfig() });
    await appendUsage(usageEvent({ runId: run.id, provider: "portkey", usd: 0.01 }));
    await appendUsage(usageEvent({ runId: null, provider: "portkey", usd: 0.02 }));
    await appendUsage(usageEvent({ runId: run.id, provider: "mock", usd: 5 }));
    await appendUsage(usageEvent({ runId: run.id, provider: "http", usd: 0.03, reportedByTarget: true }));
    expect(await readJsonl(path.join(dir, "runs", run.id, "usage.jsonl"))).toHaveLength(3);
    const spend = await keySpend();
    expect(spend.usd).toBeCloseTo(0.06, 10);
    expect(spend.calls).toBe(3);
  });
});
