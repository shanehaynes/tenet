import pLimit from "p-limit";
import { buildClassifierSystem, classifyRule } from "../agents/classifier";
import { mapCollisions } from "../agents/collisions";
import { decompose } from "../agents/decomposer";
import { ruleId } from "../ids";
import { defaultLedger } from "../model/client";
import { effectiveType, type Policy, type Rule, type Run, type RunConfig, type RunStatus } from "../schemas/records";
import { writeJsonAtomic } from "../store/fs";
import { readPolicy } from "../store/policies";
import { appendEvent, createRun, readRun, runFilePath, withRun } from "../store/runs";
import { readRunUsage, totalsFromUsage } from "../store/usage";
import { buildNoRulesSummary } from "./aggregate";
import { spendFromUsage } from "./budget";
import { startJob } from "./jobs";
import { defaultRunConfig } from "./runConfig";

// Analysis pipeline (architecture §6–7): scan (reused from the policy) → decompose → classify → awaiting
// review; confirm → map collisions → awaiting collision review. Plain code calls narrow agents; no agent calls
// another. Never call the model inside withRun: model calls happen outside, results are written after.

export class RunStateError extends Error {
  constructor(
    message: string,
    readonly code: "conflict" | "not_found" | "invalid" = "conflict",
  ) {
    super(message);
    this.name = "RunStateError";
  }
}

const HEARTBEAT_MS = 5_000;

async function setStatus(runId: string, status: RunStatus, statusReason: string | null = null): Promise<void> {
  await withRun(runId, async (tx) => {
    const run = await tx.get("run");
    tx.set("run", { ...run, status, statusReason });
  });
  await appendEvent(runId, { stage: status, message: statusReason ?? `status: ${status}` });
}

function startHeartbeat(runId: string): () => void {
  const beat = () =>
    withRun(runId, async (tx) => {
      const run = await tx.get("run");
      tx.set("run", { ...run, heartbeatAt: new Date().toISOString() });
    }).catch(() => undefined);
  void beat();
  const timer = setInterval(beat, HEARTBEAT_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}

export async function refreshTotals(runId: string): Promise<void> {
  const totals = totalsFromUsage(await readRunUsage(runId));
  await withRun(runId, async (tx) => {
    const run = await tx.get("run");
    tx.set("run", { ...run, totals });
  });
}

function reasonFor(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function failRun(runId: string, err: unknown, signal?: AbortSignal): Promise<void> {
  const cancelled = signal?.aborted ?? false;
  await withRun(runId, async (tx) => {
    const run = await tx.get("run");
    tx.set("run", {
      ...run,
      status: cancelled ? "cancelled" : "failed",
      statusReason: cancelled ? "Cancelled" : reasonFor(err),
      finishedAt: new Date().toISOString(),
    });
  }).catch(() => undefined);
  await appendEvent(runId, { level: "error", stage: "failed", message: reasonFor(err) }).catch(() => undefined);
}

function quarantineReason(policy: Policy): string {
  const flags = policy.scan?.findings.filter((f) => f.severity === "flag") ?? [];
  const first = flags[0];
  return first
    ? `Policy quarantined: line ${first.line} ("${first.excerpt}") ${first.reason}`
    : "Policy quarantined by the injection scanner.";
}

/** Creates a run for a stored policy and starts its analysis in the background. */
export async function startAnalysis(policy: Policy, overrides: Partial<RunConfig> = {}): Promise<Run> {
  const run = await createRun({ policyId: policy.id, policyName: policy.name, config: defaultRunConfig(overrides) });
  await appendEvent(run.id, { stage: "created", message: `Run created for ${policy.name}` });
  void startJob(run.id, "analysis", (signal) => runAnalysis(run.id, signal));
  return run;
}

export async function runAnalysis(runId: string, signal?: AbortSignal): Promise<void> {
  const stopHeartbeat = startHeartbeat(runId);
  const ledger = defaultLedger();
  const started = Date.now();
  try {
    const run = await readRun(runId);
    const policy = await readPolicy(run.policyId);
    if (!policy) throw new Error(`Policy ${run.policyId} not found`);
    ledger.open(runId, { capUsd: run.config.spendCapUsd, startedExecutionAt: null, spent: spendFromUsage(await readRunUsage(runId)) });

    await setStatus(runId, "scanning");
    if (policy.flagged) {
      await setStatus(runId, "quarantined", quarantineReason(policy));
      return;
    }

    await setStatus(runId, "decomposing");
    const d = await decompose(policy.text, { runId, signal });
    await appendEvent(runId, { stage: "decomposer", message: `${d.rules.length} rules extracted`, data: { warnings: d.warnings } });

    if (d.rules.length === 0) {
      await withRun(runId, async (tx) => {
        const r = await tx.get("run");
        tx.set("run", {
          ...r,
          status: "complete",
          statusReason: "This policy contains no testable rules.",
          untestablePassages: d.untestablePassages,
          warnings: [...r.warnings, ...d.warnings],
          finishedAt: new Date().toISOString(),
          wallClockMs: Date.now() - started,
        });
      });
      await refreshTotals(runId);
      const finished = await readRun(runId);
      await writeJsonAtomic(runFilePath(runId, "summary.json"), buildNoRulesSummary(finished, await readRunUsage(runId)));
      return;
    }

    const rules = await withRun(runId, async (tx) => {
      const r = await tx.get("run");
      const created: Rule[] = d.rules.map((x, i) => ({
        id: ruleId(r.nextRuleNumber + i),
        runId,
        index: i + 1,
        statement: x.statement,
        quote: x.quote,
        span: x.span,
        located: x.located,
        section: x.section,
        proposedType: null,
        probabilities: null,
        confidence: null,
        rationale: null,
        ambiguityNote: null,
        userType: null,
        parked: false,
        parkedReason: null,
        origin: "extracted",
        parentIds: [],
        coverage: null,
      }));
      tx.set("rules", created);
      tx.set("run", {
        ...r,
        status: "classifying",
        statusReason: null,
        nextRuleNumber: r.nextRuleNumber + created.length,
        untestablePassages: d.untestablePassages,
        warnings: [...r.warnings, ...d.warnings],
      });
      return created;
    });
    await appendEvent(runId, { stage: "classifying", message: `Classifying ${rules.length} rules` });

    const system = buildClassifierSystem(policy.text);
    const threshold = run.config.ambiguityThreshold;
    const classifyOne = async (rule: Rule) => {
      let update: Partial<Rule>;
      try {
        const c = await classifyRule(rule, { runId, system, signal });
        const low = c.confidence < threshold;
        update = {
          proposedType: c.type,
          probabilities: c.probabilities,
          confidence: c.confidence,
          rationale: c.rationale,
          ambiguityNote: c.ambiguityNote,
          parked: low,
          parkedReason: low ? "low_confidence" : null,
        };
      } catch (err) {
        if (signal?.aborted) throw err;
        update = { rationale: `Classification failed: ${reasonFor(err)}. Choose a type or park this rule.` };
      }
      await withRun(runId, async (tx) => {
        const all = await tx.get("rules");
        tx.set(
          "rules",
          all.map((x) => (x.id === rule.id ? { ...x, ...update } : x)),
        );
      });
    };
    // The first call writes the cached prefix; the rest run in parallel and read it.
    await classifyOne(rules[0]);
    const limit = pLimit(Math.max(1, run.config.concurrency));
    await Promise.all(rules.slice(1).map((rule) => limit(() => classifyOne(rule))));

    await refreshTotals(runId);
    await setStatus(runId, "awaiting_review");
  } catch (err) {
    await failRun(runId, err, signal);
  } finally {
    stopHeartbeat();
    await refreshTotals(runId).catch(() => undefined);
  }
}

/** Rules that stop confirmation: neither typed (effective type) nor parked. */
export function confirmBlockers(rules: Rule[], threshold: number): string[] {
  return rules
    .filter((r) => !r.parked && effectiveType(r, threshold) === null)
    .map((r) => `Rule ${r.index} (${r.id}) needs a type or must be parked.`);
}

/** awaiting_review → mapping_collisions, then maps collisions in the background. */
export async function confirmRun(runId: string): Promise<Run> {
  const run = await withRun(runId, async (tx) => {
    const r = await tx.get("run");
    if (r.status !== "awaiting_review") throw new RunStateError(`Run is ${r.status}; only a run awaiting review can be confirmed.`);
    const blockers = confirmBlockers(await tx.get("rules"), r.config.ambiguityThreshold);
    if (blockers.length) throw new RunStateError(blockers.join(" "), "invalid");
    const next: Run = { ...r, status: "mapping_collisions", statusReason: null };
    tx.set("run", next);
    return next;
  });
  await appendEvent(runId, { stage: "mapping_collisions", message: "Rules confirmed; mapping collisions" });
  void startJob(runId, "collisions", (signal) => runCollisionMapping(runId, signal));
  return run;
}

export async function runCollisionMapping(runId: string, signal?: AbortSignal): Promise<void> {
  const stopHeartbeat = startHeartbeat(runId);
  try {
    const run = await readRun(runId);
    const policy = await readPolicy(run.policyId);
    if (!policy) throw new Error(`Policy ${run.policyId} not found`);
    const ledger = defaultLedger();
    if (!ledger.isOpen(runId)) {
      ledger.open(runId, { capUsd: run.config.spendCapUsd, startedExecutionAt: null, spent: spendFromUsage(await readRunUsage(runId)) });
    }
    const rules = (await withRun(runId, (tx) => tx.get("rules")))
      .filter((r) => !r.parked)
      .map((r) => ({ id: r.id, statement: r.statement, type: effectiveType(r, run.config.ambiguityThreshold) }))
      .filter((r): r is { id: string; statement: string; type: NonNullable<typeof r.type> } => r.type !== null);
    let warning: string | null = null;
    let collisions: Awaited<ReturnType<typeof mapCollisions>> = [];
    try {
      collisions = await mapCollisions(rules, policy.text, { runId, signal });
    } catch (err) {
      if (signal?.aborted) throw err;
      warning = `Collision mapping failed: ${reasonFor(err)}`;
    }
    await withRun(runId, async (tx) => {
      const r = await tx.get("run");
      tx.set("collisions", collisions);
      tx.set("run", {
        ...r,
        status: "awaiting_collision_review",
        statusReason: null,
        warnings: warning ? [...r.warnings, warning] : r.warnings,
      });
    });
    await appendEvent(runId, {
      stage: "collisions",
      level: warning ? "warn" : "info",
      message: warning ?? `${collisions.length} collision${collisions.length === 1 ? "" : "s"} proposed`,
    });
  } catch (err) {
    await failRun(runId, err, signal);
  } finally {
    stopHeartbeat();
    await refreshTotals(runId).catch(() => undefined);
  }
}
