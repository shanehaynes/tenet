import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { settings } from "../../core/config";
import { NO_KEY_MESSAGE, resolveProvider } from "../../core/env";
import { saveCapabilities } from "../../core/model/capabilities";
import { modelClient } from "../../core/model/client";
import { providerByName } from "../../core/model/providers";
import { runSmoke } from "../../core/model/smoke";
import { samplesDir } from "../../core/store/policies";
import { keySpend } from "../../core/store/usage";
import { money, table } from "../format";
import type { Command } from "../types";

export const smokeCommand: Command = {
  name: "smoke",
  summary: "Probe the model gateway (auth, structured outputs, sampling, caching, rate limits, latency)",
  usage: "tenet smoke [--no-evidence]",
  options: { "no-evidence": { type: "boolean" } },
  async run({ values, out, err }) {
    let providerName;
    try {
      providerName = resolveProvider();
    } catch {
      err(NO_KEY_MESSAGE);
      return 1;
    }
    if (providerName === "mock") {
      err("The smoke test probes a real gateway; run it without --provider mock.");
      return 1;
    }
    const provider = providerByName(providerName);
    const model = settings().targetModel;
    out(`Probing ${provider.name} with ${model} …`);
    const report = await runSmoke(modelClient().rawCall, provider, model, samplesDir());
    await saveCapabilities(model, report.caps);
    out(table(["step", "result", "detail"], report.steps.map((s) => [s.step, s.result, s.detail])));
    const spend = await keySpend();
    out(`\n${report.calls} calls, ${money(report.usd)}. Cumulative key spend ${money(spend.usd)} of $${settings().keyBudgetUsd}.`);
    out(`Capabilities saved to data/capabilities.json (${provider.name}:${model}).`);

    if (!values["no-evidence"]) {
      const file = path.join(process.cwd(), "docs", "evidence", "model-capabilities.md");
      await mkdir(path.dirname(file), { recursive: true });
      const c = report.caps;
      const md = [
        "# Model capabilities (M01)",
        "",
        `Produced by \`npm run smoke\` on ${c.probedAt}. Provider \`${c.provider}\`, model string \`${c.modelString}\`.`,
        "",
        "| Step | Result | Detail |",
        "|---|---|---|",
        ...report.steps.map((s) => `| ${s.step} | ${s.result} | ${s.detail} |`),
        "",
        "| Capability | Value |",
        "|---|---|",
        `| Structured output mode | ${c.responseMode} |`,
        `| temperature accepted | ${c.temperature} |`,
        `| reasoning_effort values accepted | ${c.reasoningEffort === false ? "none" : c.reasoningEffort.join(", ")} |`,
        `| prompt_cache_key accepted | ${c.promptCacheKey} |`,
        `| cached tokens reported | ${c.cachedTokensReported} |`,
        `| cached on repeated 1,100+ token prefix | ${c.cachedOnRepeat} |`,
        `| reasoning tokens reported | ${c.reasoningTokensReported} |`,
        `| suggested concurrency | ${c.suggestedConcurrency} |`,
        `| median latency (ms) | ${c.medianLatencyMs} |`,
        "",
        `Smoke cost: ${report.calls} calls, ${money(report.usd)} at list price.`,
        "",
      ].join("\n");
      await writeFile(file, md, "utf8");
      out(`Evidence written to docs/evidence/model-capabilities.md.`);
    }
    return 0;
  },
};
