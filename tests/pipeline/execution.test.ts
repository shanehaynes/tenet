import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetModelClient } from "../../src/core/model/client";
import { confirmRun, startAnalysis } from "../../src/core/pipeline/analysis";
import { startExecution } from "../../src/core/pipeline/execution";
import { waitForJob } from "../../src/core/pipeline/jobs";
import { policyForFile } from "../../src/core/pipeline/policies";
import { applyRuleOps } from "../../src/core/pipeline/review";
import { readRunView } from "../../src/core/pipeline/status";
import { Summary } from "../../src/core/schemas/summary";
import { readJson } from "../../src/core/store/fs";
import { readRunFile, readTranscript, runFilePath, withRun } from "../../src/core/store/runs";

// `tenet run samples/harrow-vale.md --accept-proposed --provider mock`, as library calls (architecture §12).

const root = path.join(__dirname, "..", "..");
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "tenet-exec-"));
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

async function confirmedDemoRun(): Promise<string> {
  const policy = await policyForFile("samples/harrow-vale.md", readFileSync(path.join(root, "samples", "harrow-vale.md"), "utf8"));
  const run = await startAnalysis(policy);
  await waitForJob(run.id);
  await applyRuleOps(run.id, [{ set_type: { ruleId: "r5", type: "ordering" } }]);
  await confirmRun(run.id);
  await waitForJob(run.id);
  return run.id;
}

describe("execution pipeline (mock)", () => {
  it("completes with a judged scenario for every confirmed rule of all four types", async () => {
    const runId = await confirmedDemoRun();
    await startExecution(runId, {});
    await waitForJob(runId);
    const view = await readRunView(runId);
    expect(view.run.status).toBe("complete");

    const summary = Summary.parse(await readJson(runFilePath(runId, "summary.json")));
    expect(summary.partial).toBe(false);
    const tested = summary.rules.filter((r) => !r.parked);
    expect(new Set(tested.map((r) => r.testKind))).toEqual(new Set(["ladder", "sweep", "paraphrase", "conflict"]));
    expect(tested.every((r) => r.coverage === "tested")).toBe(true);
    expect(summary.strip.rulesTested).toBe(11);
    expect(summary.strip.scenariosNotRun).toBe(0);
    expect(summary.strip.unverifiedCount).toBe(0);

    const byIndex = new Map(summary.rules.map((r) => [r.index, r]));
    expect(byIndex.get(2)).toMatchObject({ verdict: "fail", ladder: { bentAt: 5, foldedAt: 6 } });
    expect(byIndex.get(10)?.sweep?.observedThreshold).toEqual({ lastComplied: 12000, firstRequired: 25000 });
    expect(summary.defects.collisions[0].outcome?.honored).toBe("b");
    expect(summary.planted?.every((p) => p.found === true)).toBe(true);
    expect(summary.usageByStage.map((u) => u.stage)).toEqual(expect.arrayContaining(["generator", "executor", "judge", "reporter"]));

    const scenarios = await readRunFile(runId, "scenarios");
    const transcript = await readTranscript(runId, scenarios[0].id);
    expect(transcript?.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(transcript?.systemPrompt).toContain("<policy>");
  });

  it("halts on a tiny test budget, marks the rest not run, and says why", async () => {
    const runId = await confirmedDemoRun();
    await startExecution(runId, { spendCapUsd: 0.0001 });
    await waitForJob(runId);
    const view = await readRunView(runId);
    expect(view.run.status).toBe("halted");
    expect(view.run.statusReason).toMatch(/Test budget \$0\.0001 reached during (generator|executor|judge)/);
    const scenarios = await readRunFile(runId, "scenarios");
    expect(scenarios.filter((s) => s.status === "not_run").every((s) => s.error === "test budget")).toBe(true);
    const summary = Summary.parse(await readJson(runFilePath(runId, "summary.json")));
    expect(summary.strip.failures).toBe(0);
    expect(summary.strip.analysisUsd).toBeGreaterThan(0); // analysis was never capped by the test budget
  });

  it("refuses to start before collisions are reviewed", async () => {
    const policy = await policyForFile("samples/harrow-vale.md", readFileSync(path.join(root, "samples", "harrow-vale.md"), "utf8"));
    const run = await startAnalysis(policy);
    await waitForJob(run.id);
    await expect(startExecution(run.id, {})).rejects.toThrow(/only after rules are confirmed/);
  });

  it("marks rules of a disabled generator as designed, not run (the Gate 1 cut line)", async () => {
    const runId = await confirmedDemoRun();
    await withRun(runId, async (tx) => {
      const r = await tx.get("run");
      tx.set("run", { ...r, config: { ...r.config, disabledGenerators: ["paraphrase"] } });
    });
    await startExecution(runId, {});
    await waitForJob(runId);
    const summary = Summary.parse(await readJson(runFilePath(runId, "summary.json")));
    const dispositions = summary.rules.filter((r) => r.type === "disposition");
    expect(dispositions.length).toBeGreaterThan(0);
    expect(dispositions.every((r) => r.verdict === "designed_not_run" && r.coverage === "p1_type_not_run")).toBe(true);
    expect(summary.strip.rulesP1NotRun).toBe(dispositions.length);
  });
});
