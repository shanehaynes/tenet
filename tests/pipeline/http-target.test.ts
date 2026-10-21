import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { httpTargetTiming } from "../../src/core/agents/executor";
import { resetModelClient } from "../../src/core/model/client";
import { confirmRun, startAnalysis } from "../../src/core/pipeline/analysis";
import { startExecution } from "../../src/core/pipeline/execution";
import { waitForJob } from "../../src/core/pipeline/jobs";
import { policyForFile } from "../../src/core/pipeline/policies";
import { applyRuleOps } from "../../src/core/pipeline/review";
import { httpTarget } from "../../src/core/pipeline/runConfig";
import { readRunView } from "../../src/core/pipeline/status";
import { readOrComputeSummary } from "../../src/core/pipeline/summary";
import { readRunFile, readTranscript } from "../../src/core/store/runs";
import { readRunUsage } from "../../src/core/store/usage";

// An HTTP agent under test (architecture §4.6), against a stub that speaks the HW5 bridge's protocol:
// the first request gets 409 busy, the third a 502 (the agent ended without a reply), the rest a reply
// with tool calls and the agent's own token usage.

const root = path.join(__dirname, "..", "..");
let dir: string;
let server: Server;
let url: string;
const requests: { message: string; conversation_id: string; reset: boolean; agent: string | null }[] = [];

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "tenet-http-"));
  process.env.TENET_DATA_DIR = dir;
  process.env.TENET_PROVIDER = "mock";
  process.env.TENET_SAMPLES_DIR = path.join(root, "samples");
  resetModelClient();
  httpTargetTiming.busyWaitMs = 5;
  let n = 0;
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      n += 1;
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (n === 1) return send(409, { error: "busy" });
      requests.push(JSON.parse(raw));
      if (requests.length === 2) return send(502, { error: "UsageLimitExceeded: request_limit of 6", usage: { input_tokens: 900, output_tokens: 50, cached_tokens: 0, requests: 6 } });
      send(200, {
        reply: "I can't file that without the partner's approval. I've drafted it and flagged it for review.",
        report: { status: "done" },
        actions: [{ name: "draft_customer_reply", arguments: { ticket_id: 7 }, result: { ok: true } }],
        usage: { input_tokens: 6000, output_tokens: 300, cached_tokens: 3000, requests: 2 },
        meta: { root_run_id: `run${n}`, ms: 12 },
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/tenet/ask`;
});
afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  httpTargetTiming.busyWaitMs = 2000;
  rmSync(dir, { recursive: true, force: true });
  delete process.env.TENET_DATA_DIR;
  delete process.env.TENET_PROVIDER;
  delete process.env.TENET_SAMPLES_DIR;
  resetModelClient();
});

/** The demo policy, confirmed; with `keep`, every other rule is parked first (`tenet rules --keep`). */
async function confirmedDemoRun(keep?: Set<string>): Promise<string> {
  const policy = await policyForFile("samples/harrow-vale.md", readFileSync(path.join(root, "samples", "harrow-vale.md"), "utf8"));
  const run = await startAnalysis(policy);
  await waitForJob(run.id);
  if (keep) {
    const view = await readRunView(run.id);
    await applyRuleOps(run.id, view.rules.filter((r) => !keep.has(r.id) && !r.parked).map((r) => ({ park: { ruleId: r.id } })));
  }
  await confirmRun(run.id);
  await waitForJob(run.id);
  return run.id;
}

describe("HTTP agent target", () => {
  it("refuses a run whose scenarios would exceed the agent-run limit, and leaves the run startable", async () => {
    const runId = await confirmedDemoRun();
    const target = httpTarget({ url, agent: "customer_service", name: "Stub agent" })!;
    await expect(startExecution(runId, { target })).rejects.toThrow(/limited to 40/);
    const view = await readRunView(runId);
    expect(view.run.status).toBe("awaiting_collision_review");
    expect(view.run.config.target.kind).toBe("model");
  });

  it("runs one scenario at a time, stores replies and actions, logs the agent's usage, and marks a failed agent run not run", async () => {
    const keep = new Set(["r2", "r10"]); // the filing ladder and the $10,000 sweep
    const runId = await confirmedDemoRun(keep);
    const target = httpTarget({ url, agent: "customer_service", name: "Stub agent" })!;
    await startExecution(runId, { target, concurrency: 8 });
    await waitForJob(runId);

    const done = await readRunView(runId);
    expect(done.run.status).toBe("complete");
    expect(done.run.config.concurrency).toBe(1);
    expect(done.run.config.target).toMatchObject({ kind: "http", url, agent: "customer_service", resetPerScenario: true, timeoutMs: 120_000 });

    const scenarios = await readRunFile(runId, "scenarios");
    expect(new Set(scenarios.filter((s) => s.ruleId).map((s) => s.ruleId))).toEqual(keep); // plus any collision between the two
    expect(requests.length).toBe(scenarios.length);
    expect(requests.every((r) => r.reset && r.agent === "customer_service")).toBe(true);
    expect(requests.map((r) => r.conversation_id).sort()).toEqual(scenarios.map((s) => s.id).sort());

    const failed = scenarios.filter((s) => s.status === "not_run");
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toMatch(/HTTP 502: UsageLimitExceeded/);

    const ok = scenarios.find((s) => s.status === "done")!;
    const transcript = await readTranscript(runId, ok.id);
    expect(transcript?.systemPrompt).toBeNull();
    expect(transcript?.actions).toEqual([{ name: "draft_customer_reply", arguments: { ticket_id: 7 }, result: { ok: true } }]);
    expect(transcript?.targetUsage).toEqual({ inputTokens: 6000, outputTokens: 300, cachedTokens: 3000, requests: 2 });
    expect(transcript?.model).toBe("Stub agent / customer_service");

    const usage = await readRunUsage(runId);
    const target_ = usage.filter((e) => e.stage === "target");
    expect(target_).toHaveLength(scenarios.length);
    expect(target_.every((e) => e.reportedByTarget && e.role === "target" && e.usd > 0)).toBe(true);
    expect(target_.filter((e) => !e.ok)).toHaveLength(1);
    expect(usage.some((e) => e.stage === "executor")).toBe(false); // no system prompt, no model call on Tenet's side

    const summary = await readOrComputeSummary(runId);
    expect(summary.strip.scenariosNotRun).toBe(1);
    expect(summary.strip.testUsd).toBeGreaterThan(0);
  });
});
