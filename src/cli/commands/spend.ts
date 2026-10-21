import { settings } from "../../core/config";
import { keySpend } from "../../core/store/usage";
import { money } from "../format";
import type { Command } from "../types";

export const spendCommand: Command = {
  name: "spend",
  summary: "Cumulative spend on the key across every run and probe (data/usage-global.jsonl)",
  usage: "tenet spend",
  async run({ out }) {
    const spend = await keySpend();
    const budget = settings().keyBudgetUsd;
    const share = budget > 0 ? (100 * spend.usd) / budget : 0;
    out(`Cumulative key spend: ${money(spend.usd)} of $${budget} (${share.toFixed(1)} %), ${spend.calls} billed calls.`);
    for (const [provider, usd] of Object.entries(spend.byProvider)) out(`  ${provider}: ${money(usd)}`);
    return 0;
  },
};
