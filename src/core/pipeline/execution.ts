import pLimit from "p-limit";
import { buildExecutorSystemPrompt } from "../agents/executorPrompt";
import { describeHttpTarget, executeScenario } from "../agents/executor";
import type { GenContext, GenRule } from "../agents/generators/common";
import { CONFLICT_RUBRIC, generateCollisionConflicts, generateOrderingConflicts } from "../agents/generators/conflict";
import { generateLadder, ladderRubric } from "../agents/generators/ladder";
import { generateParaphrases, PARAPHRASE_RUBRIC } from "../agents/generators/paraphrase";
import { PARAPHRASE_ITEMS } from "../agents/generators/paraphrase";
import { buildGeneratorSystem } from "../agents/generators/shared";
import { generateSweep, SWEEP_POINTS, SWEEP_RUBRIC } from "../agents/generators/sweep";
import { buildJudgeSystem, judgeScenario, type JudgeRule } from "../agents/judge";
import { summarizeDefects, type Defect } from "../agents/reporter";
import { settings } from "../config";
import { defaultLedger } from "../model/client";
import { effectiveType, type Collision, type Rule, type Run, type Scenario, type ScenarioKind, type Target, type TestDesign } from "../schemas/records";
import { readPolicy } from "../store/policies";
import { appendEvent, readRun, writeTranscript, withRun } from "../store/runs";
import { readRunUsage } from "../store/usage";
import { choiceText, collisionVerdict, testKindFor } from "./aggregate";
import { RunStateError } from "./analysis";
import { isHaltError } from "../errors";
import { spendFromUsage } from "./budget";
import { MAX_HTTP_SCENARIOS, MAX_SCENARIOS_PER_RULE } from "./guards";
import { startJob } from "./jobs";
import { failRun, reasonFor, refreshTotals, setStatus, startHeartbeat } from "./runState";
import { writeSummary } from "./summary";

// Execution pipeline (architecture §6–7): generate the test each confirmed rule's type demands, then execute
// and judge every scenario through one pool (interleaved, so verdicts arrive while others still run), then
// summarize policy defects and aggregate. The test budget halts the run cleanly: in-flight calls finish,
// the rest are marked not run, and the reason names the stage.

export type ExecuteOptions = {
  spendCapUsd?: number;
  concurrency?: number;
  rungs?: number;
  flatComparison?: boolean;
  dismiss?: string[];
  /** The agent under test; omitted keeps the run's target (the model, unless set before). */
  target?: Target;
};

const isHalt = isHaltError;

/** awaiting_collision_review → generating; starts the execution job (202 from the API). */
export async function startExecution(runId: string, opts: ExecuteOptions = {}): Promise<Run> {
  const now = new Date().toISOString();
  // Ask an HTTP agent what its world holds before the transaction (no network inside withRun).
  if (opts.target?.kind === "http" && opts.target.context === null) {
    opts = { ...opts, target: { ...opts.target, context: await describeHttpTarget(opts.target) } };
  }
  const run = await withRun(runId, async (tx) => {
    const r = await tx.get("run");
    if (r.status !== "awaiting_collision_review") {
      throw new RunStateError(`Run is ${r.status}; tests can start only after rules are confirmed and collisions reviewed.`);
    }
    if (opts.dismiss?.length) {
      const collisions = await tx.get("collisions");
      tx.set(
        "collisions",
        collisions.map((c) => (opts.dismiss!.includes(c.id) ? { ...c, dismissed: true } : c)),
      );
    }
    const target = opts.target ?? r.config.target;
    const http = target.kind === "http";
    const next: Run = {
      ...r,
      status: "generating",
      statusReason: null,
      startedExecutionAt: now,
      config: {
        ...r.config,
        target,
        spendCapUsd: opts.spendCapUsd ?? r.config.spendCapUsd,
        concurrency: http ? 1 : Math.max(1, Math.floor(opts.concurrency ?? r.config.concurrency)),
        rungs: opts.rungs ?? r.config.rungs,
        flatComparison: opts.flatComparison ?? r.config.flatComparison,
      },
    };
    if (http) {
      const estimate = estimateScenarios(next, await tx.get("rules"), await tx.get("collisions"));
      if (estimate > MAX_HTTP_SCENARIOS) {
        throw new RunStateError(
          `This run would send about ${estimate} scenarios to ${target.name}; an agent run is limited to ${MAX_HTTP_SCENARIOS}, because each scenario is a full agent run. Park some rules${next.config.rungs > 4 ? " or use 4 rungs" : ""}.`,
        );
      }
    }
    tx.set("run", next);
    return next;
  });
  const ledger = defaultLedger();
  ledger.open(runId, { capUsd: run.config.spendCapUsd, startedExecutionAt: now, spent: spendFromUsage(await readRunUsage(runId)) });
  await appendEvent(runId, { stage: "generating", message: `Tests started; test budget $${run.config.spendCapUsd}` });
  const t = run.config.target;
  if (t.kind === "http") {
    await appendEvent(
      runId,
      t.context
        ? { stage: "generating", message: `${t.name} described its environment (${t.context.length} characters); test requests will name its records` }
        : { stage: "generating", level: "warn", message: `${t.name} did not describe its environment (GET ${t.url}); test requests may name records the agent cannot find` },
    );
  }
  void startJob(runId, "execution", (signal) => runExecution(runId, signal));
  return run;
}

type Plan = { rule: GenRule; kind: ScenarioKind }[];

function planTests(run: Run, rules: Rule[]): Plan {
  const plan: Plan = [];
  for (const r of rules) {
    if (r.parked) continue;
    const type = effectiveType(r, run.config.ambiguityThreshold);
    if (!type) continue;
    const kind = testKindFor(type, r.statement);
    if (run.config.disabledGenerators.includes(kind)) continue;
    plan.push({ rule: { id: r.id, statement: r.statement, quote: r.quote, type }, kind });
  }
  return plan;
}

/** Scenarios a run will generate, at most (generators may write fewer): the HTTP cap is checked against this. */
export function estimateScenarios(run: Run, rules: Rule[], collisions: Collision[]): number {
  const per: Record<ScenarioKind, number> = { ladder: run.config.rungs, sweep: SWEEP_POINTS, paraphrase: PARAPHRASE_ITEMS, conflict: 3, flat: 1 };
  const typed = new Set(rules.filter((r) => !r.parked && effectiveType(r, run.config.ambiguityThreshold)).map((r) => r.id));
  const fromRules = planTests(run, rules).reduce((n, p) => n + per[p.kind], 0);
  const fromCollisions = collisions.filter((c) => !c.dismissed && typed.has(c.ruleA) && typed.has(c.ruleB)).length * 2;
  return fromRules + fromCollisions;
}

const RUBRIC_FOR: Record<Exclude<ScenarioKind, "flat">, (rungs: number) => string> = {
  ladder: ladderRubric,
  sweep: () => SWEEP_RUBRIC,
  paraphrase: () => PARAPHRASE_RUBRIC,
  conflict: () => CONFLICT_RUBRIC,
};

/** Runs the first task of each group alone (it writes the cached prefix), then the rest through the pool. */
async function cacheFriendly<T>(groups: T[][], limit: ReturnType<typeof pLimit>, fn: (t: T) => Promise<void>): Promise<void> {
  const heads = groups.filter((g) => g.length).map((g) => g[0]);
  await Promise.all(heads.map((t) => limit(() => fn(t))));
  await Promise.all(groups.flatMap((g) => g.slice(1)).map((t) => limit(() => fn(t))));
}

export async function runExecution(runId: string, signal?: AbortSignal): Promise<void> {
  const stopHeartbeat = startHeartbeat(runId);
  let halt: string | null = null;
  try {
    const run = await readRun(runId);
    const policy = await readPolicy(run.policyId);
    if (!policy) throw new Error(`Policy ${run.policyId} not found`);
    const ledger = defaultLedger();
    if (!ledger.isOpen(runId)) {
      ledger.open(runId, { capUsd: run.config.spendCapUsd, startedExecutionAt: run.startedExecutionAt, spent: spendFromUsage(await readRunUsage(runId)) });
    }
    const rules = await withRun(runId, (tx) => tx.get("rules"));
    const collisions = (await withRun(runId, (tx) => tx.get("collisions"))).filter((c) => !c.dismissed);
    const ruleById = new Map(rules.map((r) => [r.id, r]));
    const genRule = (id: string): GenRule | null => {
      const r = ruleById.get(id);
      const type = r ? effectiveType(r, run.config.ambiguityThreshold) : null;
      return r && type ? { id: r.id, statement: r.statement, quote: r.quote, type } : null;
    };
    // An HTTP agent takes one scenario at a time (one database, one MCP process: config.concurrency is 1);
    // Tenet's own generator and judge calls still run in parallel around it.
    const http = run.config.target.kind === "http";
    const limit = pLimit(Math.max(1, http ? settings().concurrency : run.config.concurrency));
    const agentLimit = pLimit(1);

    // 1. Generate
    const plan = planTests(run, rules);
    const systems = new Map<string, string>();
    const systemFor = (kind: Exclude<ScenarioKind, "flat">) => {
      if (!systems.has(kind)) systems.set(kind, buildGeneratorSystem(RUBRIC_FOR[kind](run.config.rungs), policy.text, run.config.target));
      return systems.get(kind)!;
    };
    const ctxFor = (kind: Exclude<ScenarioKind, "flat">): GenContext => ({
      runId,
      policyText: policy.text,
      target: run.config.target,
      system: systemFor(kind),
      rungs: run.config.rungs,
      signal,
    });
    type GenTask = { owner: string; kind: Exclude<ScenarioKind, "flat">; go: () => Promise<{ design: TestDesign; scenarios: Scenario[] }> };
    const tasks: GenTask[] = plan.map(({ rule, kind }) => ({
      owner: rule.id,
      kind: kind as Exclude<ScenarioKind, "flat">,
      go: () => {
        const ctx = ctxFor(kind as Exclude<ScenarioKind, "flat">);
        if (kind === "ladder") return generateLadder(rule, ctx);
        if (kind === "sweep") return generateSweep(rule, ctx);
        if (kind === "paraphrase") return generateParaphrases(rule, ctx);
        return generateOrderingConflicts(rule, ctx);
      },
    }));
    for (const c of collisions) {
      if (ruleById.get(c.ruleA)?.parked || ruleById.get(c.ruleB)?.parked) continue; // a parked rule is not tested, alone or in a pair
      const a = genRule(c.ruleA);
      const b = genRule(c.ruleB);
      if (a && b) tasks.push({ owner: c.id, kind: "conflict", go: () => generateCollisionConflicts(c, a, b, ctxFor("conflict")) });
    }
    await appendEvent(runId, { stage: "generating", message: `Generating tests for ${plan.length} rules and ${collisions.length} collisions` });

    const runGen = async (t: GenTask) => {
      if (halt || signal?.aborted) return;
      let result: { design: TestDesign; scenarios: Scenario[] };
      try {
        result = await t.go();
      } catch (err) {
        if (signal?.aborted) throw err;
        if (isHalt(err)) {
          halt ??= reasonFor(err);
          return;
        }
        result = {
          design: { ownerId: t.owner, kind: t.kind, context: null, impliedThreshold: null, thresholdDirection: null, thresholdSource: null, requiredBehavior: null, probe: null, warnings: [`Generation failed: ${reasonFor(err)}`], generatedAt: new Date().toISOString() },
          scenarios: [],
        };
      }
      const scenarios = result.scenarios.slice(0, MAX_SCENARIOS_PER_RULE);
      await withRun(runId, async (tx) => {
        tx.set("designs", [...(await tx.get("designs")).filter((d) => d.ownerId !== t.owner), result.design]);
        tx.set("scenarios", [...(await tx.get("scenarios")).filter((s) => (s.ruleId ?? s.collisionId) !== t.owner), ...scenarios]);
      });
      await appendEvent(runId, { stage: "generator", message: `${t.owner}: ${scenarios.length} ${t.kind} scenarios`, level: result.design.warnings.length ? "warn" : "info" });
    };
    const byKind = ["ladder", "sweep", "paraphrase", "conflict"].map((k) => tasks.filter((t) => t.kind === k));
    await cacheFriendly(byKind, limit, runGen);

    // 2. Execute and judge, interleaved
    if (!halt) {
      await setStatus(runId, "executing");
      const executorSystem = run.config.target.kind === "model" ? buildExecutorSystemPrompt(policy.text) : null;
      const judgeSystem = buildJudgeSystem(policy.text);
      let scenarios = await withRun(runId, (tx) => tx.get("scenarios"));
      if (run.config.target.kind === "http" && scenarios.filter((s) => s.status === "pending").length > MAX_HTTP_SCENARIOS) {
        // Backstop for the estimate check in startExecution: the scenarios past the cap are not sent.
        const keep = new Set(scenarios.filter((s) => s.status === "pending").slice(0, MAX_HTTP_SCENARIOS).map((s) => s.id));
        scenarios = await withRun(runId, async (tx) => {
          const next = (await tx.get("scenarios")).map((s) => (s.status === "pending" && !keep.has(s.id) ? { ...s, status: "not_run" as const, error: `agent run limit (${MAX_HTTP_SCENARIOS} scenarios)` } : s));
          tx.set("scenarios", next);
          return next;
        });
        await appendEvent(runId, { level: "warn", stage: "executor", message: `Only the first ${MAX_HTTP_SCENARIOS} scenarios are sent to ${run.config.target.name}` });
      }
      const pending = scenarios.filter((s) => s.status === "pending");
      const rulesFor = (s: Scenario): JudgeRule[] => {
        if (s.collisionId) {
          const c = collisions.find((x) => x.id === s.collisionId) as Collision;
          return [genRule(c.ruleA), genRule(c.ruleB)].filter(Boolean).map((r) => ({ statement: r!.statement, type: r!.type }));
        }
        const r = s.ruleId ? genRule(s.ruleId) : null;
        return r ? [{ statement: r.statement, type: r.type }] : [];
      };
      const markScenario = (id: string, patch: Partial<Scenario>, verdict?: import("../schemas/records").Verdict) =>
        withRun(runId, async (tx) => {
          tx.set(
            "scenarios",
            (await tx.get("scenarios")).map((s) => (s.id === id ? { ...s, ...patch } : s)),
          );
          if (verdict) tx.set("verdicts", [...(await tx.get("verdicts")).filter((v) => v.scenarioId !== id), verdict]);
        });
      const runScenario = async (s: Scenario) => {
        if (halt || signal?.aborted) return;
        const rulesForJudge = rulesFor(s);
        try {
          const exec = () => executeScenario(s, { runId, target: run.config.target, system: executorSystem, ruleStatements: rulesForJudge.map((r) => r.statement), signal });
          const transcript = await (http ? agentLimit(exec) : exec());
          await writeTranscript(runId, transcript);
          const verdict = await judgeScenario(s, transcript, { runId, system: judgeSystem, rules: rulesForJudge, signal });
          await markScenario(s.id, { status: "done", error: null }, verdict);
        } catch (err) {
          if (signal?.aborted) throw err;
          if (isHalt(err)) {
            halt ??= reasonFor(err);
            return;
          }
          await markScenario(s.id, { status: "not_run", error: reasonFor(err) });
          await appendEvent(runId, { level: "warn", stage: "executor", message: `${s.id} not run: ${reasonFor(err)}` });
        }
      };
      // Group by owner so each prefix (executor, judge) is written once before the parallel burst.
      await cacheFriendly([pending.slice(0, 1), pending.slice(1)], limit, runScenario);
    }

    if (halt) {
      await withRun(runId, async (tx) => {
        tx.set(
          "scenarios",
          (await tx.get("scenarios")).map((s) => (s.status === "pending" || s.status === "running" ? { ...s, status: "not_run" as const, error: "test budget" } : s)),
        );
        const r = await tx.get("run");
        tx.set("run", { ...r, status: "halted", statusReason: halt, finishedAt: new Date().toISOString(), wallClockMs: Date.now() - Date.parse(r.startedExecutionAt ?? r.createdAt) });
      });
      await appendEvent(runId, { level: "warn", stage: "halted", message: halt });
      await refreshTotals(runId);
      await writeSummary(runId);
      return;
    }

    // 3. Report
    await setStatus(runId, "reporting");
    const current = await withRun(runId, async (tx) => ({ rules: await tx.get("rules"), scenarios: await tx.get("scenarios"), verdicts: await tx.get("verdicts") }));
    const threshold = run.config.ambiguityThreshold;
    const verdictsById = new Map(current.verdicts.map((v) => [v.scenarioId, v]));
    const defects: Defect[] = [
      ...current.rules
        .filter((r) => r.parkedReason === "low_confidence" || (r.confidence !== null && r.confidence < threshold))
        .map((r) => ({ kind: "ambiguity" as const, key: r.id, statement: r.statement, probabilities: r.probabilities })),
      ...collisions.map((c) => {
        const v = collisionVerdict(c.id, current.scenarios, verdictsById);
        return {
          kind: "collision" as const,
          key: c.id,
          ruleA: ruleById.get(c.ruleA)?.statement ?? c.ruleA,
          ruleB: ruleById.get(c.ruleB)?.statement ?? c.ruleB,
          scenario: c.scenario,
          outcome: v ? choiceText(v.verdict) : null,
        };
      }),
    ];
    const summaries = await summarizeDefects(defects, { runId, signal });
    await withRun(runId, async (tx) => {
      const r = await tx.get("run");
      tx.set("run", { ...r, wallClockMs: Date.now() - Date.parse(r.startedExecutionAt ?? r.createdAt) });
    });
    await refreshTotals(runId);
    await writeSummary(runId, summaries);
    await withRun(runId, async (tx) => {
      const r = await tx.get("run");
      tx.set("run", { ...r, status: "complete", statusReason: null, finishedAt: new Date().toISOString() });
    });
    await appendEvent(runId, { stage: "complete", message: "Report ready" });
  } catch (err) {
    await failRun(runId, err, signal);
  } finally {
    stopHeartbeat();
    await refreshTotals(runId).catch(() => undefined);
  }
}
