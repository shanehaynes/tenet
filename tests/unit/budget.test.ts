import { describe, expect, it } from "vitest";
import { usd } from "../../src/core/model/pricing";
import { BudgetExceeded, KeyBudgetExceeded, Ledger, spendFromUsage } from "../../src/core/pipeline/budget";
import { GuardTripped, MAX_CALLS_PER_RUN } from "../../src/core/pipeline/guards";
import { totalsFromUsage } from "../../src/core/store/usage";
import { usageEvent } from "../helpers";

const prices = { inputPerM: 0.1, cachedPerM: 0.01, outputPerM: 0.5 };

function ledger(spent = 0, opts: { allowOver?: boolean; warnings?: string[] } = {}) {
  return new Ledger({
    keySpend: async () => ({ usd: spent, calls: 0, byProvider: {} }),
    keyBudgetUsd: () => 40,
    allowOverKeyBudget: () => opts.allowOver ?? false,
    warn: (m) => opts.warnings?.push(m),
  });
}

describe("pricing", () => {
  it("bills cached input at the cached rate and output (including reasoning) at the output rate", () => {
    expect(usd({ inputTokens: 1_000_000, cachedTokens: 400_000, outputTokens: 100_000 }, prices)).toBeCloseTo(0.06 + 0.004 + 0.05, 10);
  });
  it("treats unreported cached tokens as zero", () => {
    expect(usd({ inputTokens: 1_000_000, cachedTokens: null, outputTokens: 0 }, prices)).toBeCloseTo(0.1, 10);
  });
});

describe("ledger", () => {
  it("never caps analysis stages by the test budget", async () => {
    const l = ledger();
    l.open("r", { capUsd: 0, startedExecutionAt: null });
    await expect(l.assertCanCall("r", "classifier", true)).resolves.toBeUndefined();
    await expect(l.assertCanCall("r", "judge", true)).rejects.toBeInstanceOf(BudgetExceeded);
  });

  it("trips the call guard", async () => {
    const l = ledger();
    l.open("r", { capUsd: 2, startedExecutionAt: null, spent: { analysisUsd: 0, testUsd: 0, calls: MAX_CALLS_PER_RUN } });
    await expect(l.assertCanCall("r", "classifier", false)).rejects.toBeInstanceOf(GuardTripped);
  });

  it("rehydrates spend from a usage log", async () => {
    const events = [
      usageEvent({ stage: "classifier", usd: 0.001 }),
      usageEvent({ stage: "executor", usd: 0.004 }),
      usageEvent({ stage: "target", usd: 0.002, reportedByTarget: true }),
    ];
    const spent = spendFromUsage(events);
    expect(spent).toEqual({ analysisUsd: 0.001, testUsd: 0.006, calls: 2 });
    const l = ledger();
    l.open("r", { capUsd: 0.005, startedExecutionAt: "t", spent });
    await expect(l.assertCanCall("r", "judge", false)).rejects.toThrow(/Test budget \$0.005 reached during judge/);
    const totals = totalsFromUsage(events);
    expect(totals).toMatchObject({ calls: 2, testUsd: 0.006, analysisUsd: 0.001 });
  });

  it("warns at 75 % of the key budget and refuses live calls at 95 %", async () => {
    const warnings: string[] = [];
    await ledger(31, { warnings }).assertCanCall(null, "classifier", true);
    expect(warnings[0]).toMatch(/75 %/);
    await expect(ledger(38.5).assertCanCall(null, "classifier", true)).rejects.toBeInstanceOf(KeyBudgetExceeded);
    await expect(ledger(38.5).assertCanCall(null, "classifier", false)).resolves.toBeUndefined(); // mock calls are free
    await expect(ledger(38.5).assertCanCall(null, "probe", true)).resolves.toBeUndefined();
    await expect(ledger(38.5, { allowOver: true }).assertCanCall(null, "classifier", true)).resolves.toBeUndefined();
  });
});
