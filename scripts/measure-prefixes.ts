import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildClassifierSystem } from "../src/core/agents/classifier";
import { buildExecutorSystemPrompt } from "../src/core/agents/executorPrompt";
import { loadEnv, resolveProvider } from "../src/core/env";
import { modelClient } from "../src/core/model/client";
import { providerByName } from "../src/core/model/providers";
import { CHARS_PER_TOKEN, estimateTokens } from "../src/core/model/tokens";

// `npm run measure:prefixes`: the real prompt-token count of each static prefix on the demo policy, and
// whether a repeat call is served from the cache. Calibrates CHARS_PER_TOKEN and backs the caching claims
// in the tokenomics section. Two calls per prefix, logged with stage "probe". Agents add their prefix here.

async function main() {
  loadEnv();
  const provider = providerByName(resolveProvider());
  const policy = readFileSync("samples/harrow-vale.md", "utf8");
  const prefixes: Record<string, string> = {
    executor: buildExecutorSystemPrompt(policy),
    classifier: buildClassifierSystem(policy),
  };
  const rows: string[] = [];
  for (const [name, system] of Object.entries(prefixes)) {
    const req = {
      stage: "probe" as const,
      model: "gpt-6-luna",
      system,
      user: "Reply with the single word OK.",
      maxCompletionTokens: 300,
      timeoutMs: 90_000,
      reasoningEffort: "low",
    };
    const a = await modelClient().rawCall(provider, req, { runId: null, stage: "probe" });
    const b = await modelClient().rawCall(provider, req, { runId: null, stage: "probe" });
    const input = a.response.usage?.input ?? 0;
    const cached = b.response.usage?.cached ?? null;
    const row = `| ${name} | ${system.length} | ${estimateTokens(system)} | ${input} | ${(system.length / Math.max(1, input)).toFixed(2)} | ${cached ?? "not reported"} |`;
    rows.push(row);
    console.log(row);
  }
  const file = path.join("docs", "evidence", "tokenomics", "prefix-measurement.md");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    [
      "# Static prefix measurement",
      "",
      `Measured ${new Date().toISOString()} on gpt-6-luna via ${provider.name}, demo policy (Harrow & Vale). Each prefix is sent twice with the same user message; "cached on repeat" is the second call's \`cached_tokens\`. The estimate divides characters by ${CHARS_PER_TOKEN}.`,
      "",
      "| Prefix | Characters | Estimated tokens | Prompt tokens (first call) | Chars per token | Cached on repeat |",
      "|---|---|---|---|---|---|",
      ...rows,
      "",
      "History: on 2026-10-21 the first executor preamble measured 884 prompt tokens (4,554 characters) and was not cached on repeat (0 cached), because the chars ÷ 4 estimate had overstated it by 29 %. The preamble gained two paragraphs (systems the assistant can use; stating actions taken) and the estimate was recalibrated.",
      "",
    ].join("\n"),
  );
  console.log(`Written to ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
