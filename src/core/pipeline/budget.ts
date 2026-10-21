import { TEST_STAGES, type Stage, type UsageEvent } from "../schemas/records";
import type { KeySpend } from "../store/usage";
import { GuardTripped, MAX_CALLS_PER_RUN } from "./guards";

// Spend control (architecture §7). The per-run cap is a *test* budget: it applies to generation, execution,
// judging, reporting and target-reported usage. Analysis stages are bounded by the loop guards instead, so a
// $0.01 demo budget does not trip during classification. A second, cumulative check protects the course
// key's $40 budget across every run.

export class BudgetExceeded extends Error {
  constructor(
    readonly runId: string,
    readonly stage: Stage,
    readonly capUsd: number,
    readonly spentUsd: number,
    readonly calls: number,
  ) {
    super(`Test budget $${capUsd} reached during ${stage} after ${calls} calls ($${spentUsd.toFixed(4)} logged)`);
    this.name = "BudgetExceeded";
  }
}

export class KeyBudgetExceeded extends Error {
  constructor(spentUsd: number, budgetUsd: number) {
    super(
      `Cumulative spend on the key is $${spentUsd.toFixed(2)} of a $${budgetUsd} budget (95 % reached); live calls are refused. ` +
        "Set TENET_ALLOW_OVER_KEY_BUDGET=1 to continue anyway.",
    );
    this.name = "KeyBudgetExceeded";
  }
}

export type RunSpend = { analysisUsd: number; testUsd: number; calls: number };
export type LedgerSnapshot = RunSpend & { capUsd: number; startedExecutionAt: string | null };

export type LedgerDeps = {
  keySpend: () => Promise<KeySpend>;
  keyBudgetUsd: () => number;
  allowOverKeyBudget: () => boolean;
  warn: (message: string) => void;
};

/** Sums a run's usage log into the spend the ledger tracks (used to rehydrate after a restart). */
export function spendFromUsage(events: UsageEvent[]): RunSpend {
  const out: RunSpend = { analysisUsd: 0, testUsd: 0, calls: 0 };
  for (const e of events) {
    if (e.reportedByTarget) {
      out.testUsd += e.usd;
      continue;
    }
    out.calls += 1;
    if (TEST_STAGES.has(e.stage)) out.testUsd += e.usd;
    else out.analysisUsd += e.usd;
  }
  return out;
}

export class Ledger {
  private runs = new Map<string, LedgerSnapshot>();
  private warnedAt = 0;

  constructor(private deps: LedgerDeps) {}

  open(runId: string, opts: { capUsd: number; startedExecutionAt: string | null; spent?: RunSpend }): void {
    const spent = opts.spent ?? { analysisUsd: 0, testUsd: 0, calls: 0 };
    this.runs.set(runId, { ...spent, capUsd: opts.capUsd, startedExecutionAt: opts.startedExecutionAt });
  }

  isOpen(runId: string): boolean {
    return this.runs.has(runId);
  }

  close(runId: string): void {
    this.runs.delete(runId);
  }

  setCap(runId: string, capUsd: number): void {
    const r = this.runs.get(runId);
    if (r) r.capUsd = capUsd;
  }

  startExecution(runId: string, at: string): void {
    const r = this.runs.get(runId);
    if (r) r.startedExecutionAt = at;
  }

  /** Throws before a call that would breach the key budget, the run's call guard or its test budget. */
  async assertCanCall(runId: string | null, stage: Stage, billed: boolean): Promise<void> {
    if (billed && stage !== "probe") await this.checkKeyBudget();
    if (!runId) return;
    const r = this.runs.get(runId);
    if (!r) return;
    if (r.calls >= MAX_CALLS_PER_RUN) {
      throw new GuardTripped(`Run ${runId} reached the limit of ${MAX_CALLS_PER_RUN} model calls`);
    }
    if (TEST_STAGES.has(stage) && r.testUsd >= r.capUsd) {
      throw new BudgetExceeded(runId, stage, r.capUsd, r.testUsd + r.analysisUsd, r.calls);
    }
  }

  record(event: UsageEvent): void {
    if (!event.runId) return;
    const r = this.runs.get(event.runId);
    if (!r) return;
    if (event.reportedByTarget) {
      r.testUsd += event.usd;
      return;
    }
    r.calls += 1;
    if (TEST_STAGES.has(event.stage)) r.testUsd += event.usd;
    else r.analysisUsd += event.usd;
  }

  snapshot(runId: string): LedgerSnapshot | null {
    const r = this.runs.get(runId);
    return r ? { ...r } : null;
  }

  private async checkKeyBudget(): Promise<void> {
    const budget = this.deps.keyBudgetUsd();
    const spent = (await this.deps.keySpend()).usd;
    if (spent >= 0.95 * budget && !this.deps.allowOverKeyBudget()) throw new KeyBudgetExceeded(spent, budget);
    const level = spent >= 0.95 * budget ? 95 : spent >= 0.75 * budget ? 75 : 0;
    if (level > this.warnedAt) {
      this.warnedAt = level;
      this.deps.warn(`Cumulative spend on the key is $${spent.toFixed(2)} of $${budget} (${level} % threshold).`);
    }
  }
}
