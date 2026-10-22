import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import pLimit from "p-limit";
import { z } from "zod";
import { buildJudgeSystem, judgeScenario } from "../../core/agents/judge";
import { settings } from "../../core/config";
import { resolveProvider } from "../../core/env";
import { exportRows, parseCsv, rowsToCsv, scoreSpotcheck } from "../../core/eval/spotcheck";
import { readCapabilitiesFile } from "../../core/model/capabilities";
import { readAllTranscripts, readOrComputeSummary, writeSummary } from "../../core/pipeline/summary";
import { capabilitiesKey } from "../../core/schemas/capabilities";
import { effectiveType, Verdict } from "../../core/schemas/records";
import { readPolicy } from "../../core/store/policies";
import { readRun, readRunFile, runFilePath, withRun } from "../../core/store/runs";
import { readRunUsage } from "../../core/store/usage";
import { money, table } from "../format";
import type { Command } from "../types";

const EVIDENCE = path.join("docs", "evidence");

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export const spotcheckCommand: Command = {
  name: "spotcheck",
  summary: "Judge spot check (M05): export a blind sample to score by hand, then score it",
  usage: "tenet spotcheck export <runId> [--n 50] [--seed 7] | tenet spotcheck score <runId> <file.csv> [--verdicts file.json]",
  options: { n: { type: "string" }, seed: { type: "string" }, verdicts: { type: "string" } },
  async run({ values, positionals, out, err }) {
    const [mode, runId, csvFile] = positionals;
    if (!runId || !["export", "score"].includes(mode)) {
      err(this.usage);
      return 1;
    }
    const run = await readRun(runId);
    const dir = path.join(EVIDENCE, "spotcheck");
    if (mode === "export") {
      const [scenarios, verdicts, rules, transcripts] = await Promise.all([
        readRunFile(runId, "scenarios"),
        readRunFile(runId, "verdicts"),
        readRunFile(runId, "rules"),
        readAllTranscripts(runId),
      ]);
      const rows = exportRows({ scenarios, verdicts, rules, transcripts, threshold: run.config.ambiguityThreshold, n: Number(values.n ?? 50), seed: Number(values.seed ?? 7) });
      const file = path.join(dir, `${runId}-blank.csv`);
      await mkdir(dir, { recursive: true });
      await writeFile(file, rowsToCsv(rows), "utf8");
      const byRubric = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.rubric]: (acc[r.rubric] ?? 0) + 1 }), {});
      out(`${rows.length} scenarios written to ${file} (${Object.entries(byRubric).map(([k, v]) => `${k} ${v}`).join(", ")}).`);
      out("Fill human_verdict with one of the allowed_verdicts on each row, without opening this run's report, and save as");
      out(`  ${path.join(dir, `${runId}-shane.csv`)}`);
      return 0;
    }
    if (!csvFile) {
      err("Give the scored CSV file.");
      return 1;
    }
    const rows = parseCsv(await readFile(csvFile, "utf8"));
    const verdicts = values.verdicts ? z.array(Verdict).parse(JSON.parse(await readFile(values.verdicts as string, "utf8"))) : await readRunFile(runId, "verdicts");
    const [scenarios, designs] = await Promise.all([readRunFile(runId, "scenarios"), readRunFile(runId, "designs")]);
    const a = scoreSpotcheck({ runId, rows, verdicts, scenarios, designs });
    const suffix = values.verdicts ? `-${path.basename(values.verdicts as string, ".json")}` : "";
    const file = path.join(dir, `agreement-${runId}${suffix}.json`);
    await writeJson(file, { scoredAt: new Date().toISOString(), csv: csvFile, verdicts: values.verdicts ?? "verdicts.json", ...a });
    const pct = (x: number) => `${(100 * x).toFixed(1)} %`;
    out(`Exact agreement ${a.exact.agree}/${a.exact.total} = ${pct(a.exact.rate)}; problem vs no problem ${pct(a.problem.rate)}.`);
    out(table(["rubric", "agree", "total", "rate"], Object.entries(a.perRubric).map(([k, v]) => [k, v.agree, v.total, pct(v.rate)])));
    if (a.skipped.length) out(`Skipped ${a.skipped.length}: ${a.skipped.slice(0, 5).map((s) => `${s.scenarioId} (${s.reason})`).join("; ")}`);
    out(`Written to ${file}`);
    return 0;
  },
};

export const rejudgeCommand: Command = {
  name: "rejudge",
  summary: "Re-judge a run's transcripts: with a cheaper judge setting (M19, a second verdicts file), or --replace with the current judge after a judge fix",
  usage: "tenet rejudge <runId> --effort none [--concurrency 6]  |  tenet rejudge <runId> --replace --reason \"why\"",
  options: { effort: { type: "string" }, concurrency: { type: "string" }, replace: { type: "boolean" }, reason: { type: "string" } },
  async run({ values, positionals, out, err }) {
    const runId = positionals[0];
    const effort = values.effort as string | undefined;
    const replace = values.replace === true;
    if (!runId || (!effort && !replace) || (replace && !values.reason)) {
      err(this.usage);
      return 1;
    }
    const provider = resolveProvider();
    if (provider !== "mock" && effort) {
      const caps = (await readCapabilitiesFile())[capabilitiesKey(provider, settings().judgeModel)];
      const accepted = caps?.reasoningEffort || [];
      if (!accepted.includes(effort)) {
        err(`reasoning_effort "${effort}" is not accepted by ${settings().judgeModel} (accepted: ${accepted.join(", ") || "none probed"}). Run npm run smoke to re-probe.`);
        return 1;
      }
    }
    const run = await readRun(runId);
    const policy = await readPolicy(run.policyId);
    if (!policy) throw new Error("policy not found");
    const [scenarios, rules, collisions, original, transcripts, usage] = await Promise.all([
      readRunFile(runId, "scenarios"),
      readRunFile(runId, "rules"),
      readRunFile(runId, "collisions"),
      readRunFile(runId, "verdicts"),
      readAllTranscripts(runId),
      readRunUsage(runId),
    ]);
    const threshold = run.config.ambiguityThreshold;
    const ruleBy = new Map(rules.map((r) => [r.id, r]));
    const judgeRule = (id: string) => {
      const r = ruleBy.get(id);
      return r ? { statement: r.statement, type: effectiveType(r, threshold) ?? "constraint" } : null;
    };
    const system = buildJudgeSystem(policy.text);
    const totals = { calls: 0, usd: 0, inputTokens: 0, cachedTokens: 0, outputTokens: 0, reasoningTokens: 0 };
    const limit = pLimit(Number(values.concurrency ?? 6));
    const judged = new Set(original.map((v) => v.scenarioId));
    const todo = scenarios.filter((s) => judged.has(s.id) && transcripts[s.id]);
    const verdicts = (
      await Promise.all(
        todo.map((s) =>
          limit(async () => {
            const c = s.collisionId ? collisions.find((x) => x.id === s.collisionId) : null;
            const ruleList = (c ? [judgeRule(c.ruleA), judgeRule(c.ruleB)] : [s.ruleId ? judgeRule(s.ruleId) : null]).filter((r): r is NonNullable<typeof r> => r !== null);
            try {
              return await judgeScenario(s, transcripts[s.id], {
                runId: null,
                system,
                rules: ruleList,
                reasoningEffort: effort,
                onCall: (u) => {
                  totals.calls++;
                  totals.usd += u.usd;
                  totals.inputTokens += u.inputTokens;
                  totals.cachedTokens += u.cachedTokens;
                  totals.outputTokens += u.outputTokens;
                  totals.reasoningTokens += u.reasoningTokens;
                },
              });
            } catch (e) {
              err(`${s.id}: ${(e as Error).message}`);
              return null;
            }
          }),
        ),
      )
    ).filter((v): v is NonNullable<typeof v> => v !== null);
    const origBy = new Map(original.map((v) => [v.scenarioId, v]));
    const same = verdicts.filter((v) => origBy.get(v.scenarioId)?.verdict === v.verdict).length;
    if (replace) {
      // The agent's behavior (the transcripts) is unchanged; only the judge is. Keep the old verdicts beside the
      // new ones and record every verdict that changed, so the report can say what the fix moved.
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const previous = await readOrComputeSummary(runId);
      const keep = new Map<string, string>([
        ...previous.defects.collisions.map((c) => [c.collisionId, c.summary] as [string, string]),
        ...previous.defects.ambiguities.map((a) => [a.ruleId, a.summary] as [string, string]),
      ]);
      await writeJson(runFilePath(runId, `verdicts-before-rejudge-${stamp}.json`), original);
      const byId = new Map(verdicts.map((v) => [v.scenarioId, v]));
      await withRun(runId, async (tx) => tx.set("verdicts", (await tx.get("verdicts")).map((v) => byId.get(v.scenarioId) ?? v)));
      await writeSummary(runId, keep);
      const changed = verdicts
        .filter((v) => origBy.get(v.scenarioId)?.verdict !== v.verdict)
        .map((v) => ({ scenarioId: v.scenarioId, before: origBy.get(v.scenarioId)?.verdict ?? null, after: v.verdict, evidence: v.evidence, verified: v.verified, note: v.note }));
      const efile = path.join(EVIDENCE, "judge", `rejudge-${runId}-${stamp}.json`);
      await writeJson(efile, { runId, reason: values.reason, judgedAt: new Date().toISOString(), scenarios: verdicts.length, unchanged: same, changed, cost: totals });
      out(`Re-judged ${verdicts.length} transcripts with the current judge (${money(totals.usd)}); ${verdicts.length - same} verdicts changed. Old verdicts kept in the run folder; evidence: ${efile}.`);
      for (const c of changed) out(`  ${c.scenarioId}: ${c.before} → ${c.after}`);
      return 0;
    }
    const judgeUsage = usage.filter((e) => e.stage === "judge");
    const baseline = {
      calls: judgeUsage.length,
      usd: judgeUsage.reduce((s, e) => s + e.usd, 0),
      outputTokens: judgeUsage.reduce((s, e) => s + e.outputTokens, 0),
      reasoningTokens: judgeUsage.reduce((s, e) => s + (e.reasoningTokens ?? 0), 0),
    };
    const vfile = runFilePath(runId, `verdicts-effort-${effort}.json`);
    await writeJson(vfile, verdicts);
    const efile = path.join(EVIDENCE, "tokenomics", `rejudge-${runId}-${effort}.json`);
    await writeJson(efile, {
      runId,
      effort,
      judgedAt: new Date().toISOString(),
      scenarios: verdicts.length,
      agreementWithDefaultJudge: { same, total: verdicts.length, rate: verdicts.length ? same / verdicts.length : 0 },
      cost: { cheaper: totals, defaultJudge: { effort: "low", ...baseline } },
      verdictsFile: path.relative(process.cwd(), vfile),
    });
    out(`Re-judged ${verdicts.length} transcripts at effort "${effort}": ${money(totals.usd)} (default judge ${money(baseline.usd)}); same verdict as the default judge on ${same}/${verdicts.length}.`);
    out(`Verdicts: ${vfile}. Evidence: ${efile}. Score against Shane's CSV with: tenet spotcheck score ${runId} <csv> --verdicts ${vfile}`);
    return 0;
  },
};

export const timingCommand: Command = {
  name: "timing",
  summary: "Model time per rule from the usage log (M13): generator + executor + judge",
  usage: "tenet timing <runId> --rules r2,r4,r10",
  options: { rules: { type: "string" } },
  async run({ values, positionals, out, err }) {
    const runId = positionals[0];
    if (!runId || !values.rules) {
      err(this.usage);
      return 1;
    }
    const ids = String(values.rules).split(",").map((s) => s.trim()).filter(Boolean);
    const [usage, rules] = await Promise.all([readRunUsage(runId), readRunFile(runId, "rules")]);
    const ruleBy = new Map(rules.map((r) => [r.id, r]));
    const rows = ids.map((id) => {
      const es = usage.filter((e) => e.ruleId === id && ["generator", "executor", "judge"].includes(e.stage));
      const byStage = Object.fromEntries(["generator", "executor", "judge"].map((st) => [st, es.filter((e) => e.stage === st).reduce((s, e) => s + e.ms, 0)]));
      const starts = es.map((e) => Date.parse(e.ts) - e.ms);
      const ends = es.map((e) => Date.parse(e.ts));
      return {
        ruleId: id,
        statement: ruleBy.get(id)?.statement ?? null,
        calls: es.length,
        modelMs: es.reduce((s, e) => s + e.ms, 0),
        byStageMs: byStage,
        wallMs: es.length ? Math.max(...ends) - Math.min(...starts) : 0,
        usd: es.reduce((s, e) => s + e.usd, 0),
      };
    });
    const file = path.join(EVIDENCE, "timing", `tenet-${runId}.json`);
    await writeJson(file, {
      runId,
      measuredAt: new Date().toISOString(),
      note: "modelMs sums every generator, executor and judge call for the rule (calls run in parallel, so it overstates elapsed time); wallMs is first call start to last call end for the rule.",
      rules: rows,
      totals: { modelMs: rows.reduce((s, r) => s + r.modelMs, 0), wallMsMax: Math.max(0, ...rows.map((r) => r.wallMs)) },
    });
    out(table(["rule", "calls", "model time", "wall time", "cost"], rows.map((r) => [r.ruleId, r.calls, `${(r.modelMs / 1000).toFixed(1)} s`, `${(r.wallMs / 1000).toFixed(1)} s`, money(r.usd)])));
    out(`Written to ${file}`);
    return 0;
  },
};
