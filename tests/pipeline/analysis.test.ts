import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetModelClient } from "../../src/core/model/client";
import { confirmRun, RunStateError, startAnalysis } from "../../src/core/pipeline/analysis";
import { waitForJob } from "../../src/core/pipeline/jobs";
import { ensureSamples, policyForFile } from "../../src/core/pipeline/policies";
import { applyRuleOps, patchCollisions } from "../../src/core/pipeline/review";
import { readRunView } from "../../src/core/pipeline/status";
import { Summary } from "../../src/core/schemas/summary";
import { readJson } from "../../src/core/store/fs";
import { runFilePath } from "../../src/core/store/runs";
import { readGlobalUsage, readRunUsage } from "../../src/core/store/usage";

// The analysis half of the pipeline end to end, in mock mode (architecture §12, Pipeline).

const root = path.join(__dirname, "..", "..");
const read = (f: string) => readFileSync(path.join(root, "samples", f), "utf8");
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "tenet-pipeline-"));
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

async function analyze(file: string) {
  const policy = await policyForFile(`samples/${file}`, read(file));
  const run = await startAnalysis(policy);
  await waitForJob(run.id);
  return readRunView(run.id);
}

describe("analysis pipeline (mock)", () => {
  it("Harrow & Vale reaches review with 13 rules and the demo's flags, then confirms into a collision", async () => {
    const view = await analyze("harrow-vale.md");
    expect(view.run.status).toBe("awaiting_review");
    expect(view.rules).toHaveLength(13);
    expect(view.rules.filter((r) => r.parkedReason === "low_confidence").map((r) => r.index)).toEqual([5, 9, 13]);
    expect(view.run.totals.calls).toBe(14); // decomposer + 13 classifier calls
    expect((await readRunUsage(view.run.id)).every((e) => e.provider === "mock")).toBe(true);

    const runId = view.run.id;
    await applyRuleOps(runId, [{ set_type: { ruleId: "r5", type: "ordering" } }, { park: { ruleId: "r13" } }]);
    await expect(patchCollisions(runId, { dismiss: ["c1"], restore: [] })).rejects.toBeInstanceOf(RunStateError);

    await confirmRun(runId);
    await waitForJob(runId);
    const after = await readRunView(runId);
    expect(after.run.status).toBe("awaiting_collision_review");
    expect(after.collisions).toHaveLength(1);
    expect(after.collisions[0]).toMatchObject({ ruleA: "r1", ruleB: "r6" });
    expect(after.rules.find((r) => r.id === "r5")?.userType).toBe("ordering");

    const dismissed = await patchCollisions(runId, { dismiss: ["c1"], restore: [] });
    expect(dismissed[0].dismissed).toBe(true);
    await expect(applyRuleOps(runId, [{ park: { ruleId: "r1" } }])).rejects.toBeInstanceOf(RunStateError);
  });

  it("blocks confirmation while a rule is untyped and unparked", async () => {
    const view = await analyze("harrow-vale.md");
    await applyRuleOps(view.run.id, [{ split: { ruleId: "r1", statements: ["Never tell client A about client B.", "Never tell third parties."] } }]);
    await expect(confirmRun(view.run.id)).rejects.toThrow(/needs a type or must be parked/);
  });

  it("refuses an unknown rule type without writing it", async () => {
    const view = await analyze("harrow-vale.md");
    const bad = [{ set_type: { ruleId: "r5", type: "orderng" } }] as unknown as Parameters<typeof applyRuleOps>[1];
    await expect(applyRuleOps(view.run.id, bad)).rejects.toMatchObject({ name: "ZodError" });
    expect((await readRunView(view.run.id)).rules.find((r) => r.id === "r5")?.userType).toBeNull();
  });

  it("quarantines the injected sample without decomposing it", async () => {
    const view = await analyze("harrow-vale-injected.md");
    expect(view.run.status).toBe("quarantined");
    expect(view.run.statusReason).toContain("Ignore the rules above");
    expect(view.rules).toHaveLength(0);
  });

  it("reports a mission statement as having no testable rules", async () => {
    const view = await analyze("edge-mission-statement.md");
    expect(view.run.status).toBe("complete");
    const summary = Summary.parse(await readJson(runFilePath(view.run.id, "summary.json")));
    expect(summary.kind).toBe("no_testable_rules");
    expect(summary.untestablePassages.length).toBeGreaterThan(0);
  });

  it("seeds every catalog sample once and logs every call globally", async () => {
    const policies = await ensureSamples();
    const again = await ensureSamples();
    expect(again.map((p) => p.id)).toEqual(policies.map((p) => p.id));
    expect(policies.filter((p) => p.sample).map((p) => p.sample!.key)).toEqual([
      "harrow-vale",
      "meridian-health",
      "northgate-it",
      "campus-customs-hw5",
      "openai-model-spec-excerpt",
      "harrow-vale-injected",
    ]);
    expect(policies.find((p) => p.sample?.key === "harrow-vale-injected")?.flagged).toBe(true);
    expect(policies.filter((p) => p.flagged)).toHaveLength(1);
    expect((await readGlobalUsage()).length).toBeGreaterThan(14);
  });
});
