import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadEnv } from "../src/core/env";
import { classifyBatch } from "../src/core/agents/classifier";
import { evaluateClassifier, LabelsFile, reportMarkdown, type EvalReport } from "../src/core/eval/classifierEval";
import { readRunUsage } from "../src/core/store/usage";
import { startAnalysis } from "../src/core/pipeline/analysis";
import { waitForJob } from "../src/core/pipeline/jobs";
import { policyForFile } from "../src/core/pipeline/policies";
import { readRunView } from "../src/core/pipeline/status";
import { readPolicy } from "../src/core/store/policies";

// `npm run eval:classifier -- --run <runId> [--run <runId> …]`, or `-- samples/<policy>.md` to analyze first.
// Writes docs/evidence/labels/eval-<policy>-<runId>.{json,md} for live runs (M03). Refuses a live analysis
// of a policy whose labels are blank or not yet committed: the commit order is the evidence the labels were
// blind (sample-policies.md §6.2).

function labelsCommitted(file: string): boolean | null {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%H", "--", file], { encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain", "--", file], { encoding: "utf8" }).trim();
    return out.length > 0 && dirty.length === 0;
  } catch {
    return null; // git unavailable: cannot check
  }
}

async function loadLabels(file: string): Promise<LabelsFile> {
  return LabelsFile.parse(JSON.parse(await readFile(file, "utf8")));
}

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: { run: { type: "string", multiple: true }, labels: { type: "string" }, provider: { type: "string" }, threshold: { type: "string" }, batched: { type: "boolean" } },
    allowPositionals: true,
  });
  if (values.provider) process.env.TENET_PROVIDER = values.provider;
  loadEnv();
  const runIds = [...(values.run ?? [])];

  for (const file of positionals) {
    const sampleKey = path.basename(file).replace(/\.(md|txt)$/i, "");
    const labelsPath = values.labels ?? path.join("samples", `${sampleKey}.labels.json`);
    const labels = await loadLabels(labelsPath);
    const live = (process.env.TENET_PROVIDER ?? "auto") !== "mock";
    if (live) {
      if (labels.rules.some((r) => r.label === "")) {
        console.error(`${labelsPath} still has blank labels; label every rule and commit before a live run.`);
        return 1;
      }
      if (labelsCommitted(labelsPath) === false) {
        console.error(`${labelsPath} is not committed (or has uncommitted changes). Commit the labels before any live classifier run.`);
        return 1;
      }
    }
    const policy = await policyForFile(file, await readFile(file, "utf8"));
    const run = await startAnalysis(policy);
    console.log(`Analyzing ${policy.name} (run ${run.id}) …`);
    await waitForJob(run.id);
    runIds.push(run.id);
  }
  if (!runIds.length) {
    console.error("Usage: npm run eval:classifier -- --run <runId> | samples/<policy>.md [--labels file] [--provider mock]");
    return 1;
  }

  const reports: EvalReport[] = [];
  for (const runId of runIds) {
    const view = await readRunView(runId);
    const policy = await readPolicy(view.run.policyId);
    if (!policy) throw new Error(`Policy for run ${runId} not found`);
    const key = policy.sample?.key;
    const labelsPath = values.labels ?? (key ? path.join("samples", `${key}.labels.json`) : null);
    if (!labelsPath) {
      console.error(`Run ${runId} is not a sample policy; pass --labels.`);
      return 1;
    }
    const labels = await loadLabels(labelsPath);
    const threshold = values.threshold ? Number(values.threshold) : view.run.config.ambiguityThreshold;
    const report = evaluateClassifier(policy.text, view.rules, labels, { primaryThreshold: threshold });
    reports.push(report);
    if (values.batched) {
      // M11: the same rules (same decomposition) classified in one call, compared with the run's per-rule calls.
      const batch = await classifyBatch(view.rules, { policyText: policy.text });
      const batchedRules = view.rules.map((r) => {
        const c = batch.results.get(r.id);
        return c ? { ...r, proposedType: c.type, probabilities: c.probabilities, confidence: c.confidence } : { ...r, proposedType: null, probabilities: null, confidence: null };
      });
      const batchedReport = evaluateClassifier(policy.text, batchedRules, labels, { primaryThreshold: threshold });
      const perRule = (await readRunUsage(runId)).filter((e) => e.stage === "classifier");
      const at = (r: EvalReport) => r.thresholds.find((t) => t.threshold === r.primaryThreshold)!;
      const comparison = {
        runId,
        policy: report.policy,
        measuredAt: new Date().toISOString(),
        rules: view.rules.length,
        missingFromBatch: view.rules.filter((r) => !batch.results.has(r.id)).map((r) => r.id),
        perRule: {
          calls: perRule.length,
          usd: perRule.reduce((s, e) => s + e.usd, 0),
          inputTokens: perRule.reduce((s, e) => s + e.inputTokens, 0),
          cachedTokens: perRule.reduce((s, e) => s + (e.cachedTokens ?? 0), 0),
          outputTokens: perRule.reduce((s, e) => s + e.outputTokens, 0),
          agreement: at(report),
        },
        batched: { calls: batch.calls, usd: batch.usd, inputTokens: batch.inputTokens, outputTokens: batch.outputTokens, reasoningTokens: batch.reasoningTokens, agreement: at(batchedReport) },
      };
      console.log(`Batched: ${comparison.batched.calls} call, $${comparison.batched.usd.toFixed(5)}, agreement ${(100 * comparison.batched.agreement.agreement).toFixed(1)} % vs per-rule ${comparison.perRule.calls} calls, $${comparison.perRule.usd.toFixed(5)}, agreement ${(100 * comparison.perRule.agreement.agreement).toFixed(1)} %`);
      if (view.run.config.provider !== "mock") {
        const dir = path.join("docs", "evidence", "tokenomics");
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, `classifier-batch-${report.policy}-${runId}.json`), `${JSON.stringify(comparison, null, 2)}\n`);
      }
    }
    const md = reportMarkdown(report);
    console.log(`\n${md}`);
    if (view.run.config.provider !== "mock") {
      const dir = path.join("docs", "evidence", "labels");
      await mkdir(dir, { recursive: true });
      const base = path.join(dir, `eval-${report.policy}-${runId}`);
      await writeFile(`${base}.json`, `${JSON.stringify({ runId, model: view.run.config.targetModel, evaluatedAt: new Date().toISOString(), ...report }, null, 2)}\n`);
      await writeFile(`${base}.md`, md);
      console.log(`Evidence written to ${base}.json and .md`);
    } else {
      console.log("(mock run: no evidence written)");
    }
  }

  if (reports.length > 1) {
    const at = (r: EvalReport) => r.thresholds.find((t) => t.threshold === r.primaryThreshold)!;
    const agree = reports.reduce((s, r) => s + at(r).agree, 0);
    const total = reports.reduce((s, r) => s + at(r).total, 0);
    console.log(`Pooled agreement over ${reports.length} policies: ${agree}/${total} = ${total ? ((100 * agree) / total).toFixed(1) : "0"} %`);
  }
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
