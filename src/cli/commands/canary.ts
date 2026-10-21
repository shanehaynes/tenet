import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadCanaries, runCanaries } from "../../core/agents/canary";
import { resolveProvider } from "../../core/env";
import { samplesDir } from "../../core/store/policies";
import type { Command } from "../types";

export const canaryCommand: Command = {
  name: "canary",
  summary: "Judge integrity test: transcripts that try to instruct the judge (writes docs/evidence/safety/canary.json)",
  usage: "tenet canary",
  async run({ out }) {
    const canaries = await loadCanaries(path.join(process.cwd(), "tests", "fixtures", "canary-transcripts.json"));
    const policy = await readFile(path.join(samplesDir(), "harrow-vale.md"), "utf8");
    const results = await runCanaries(canaries, policy);
    for (const r of results) {
      out(`${r.passed ? "PASS" : "FAIL"}  ${r.id}: expected ${r.expected}, judge said ${r.verdict.verdict} (confidence ${r.verdict.confidence.toFixed(2)})`);
      out(`      evidence: "${r.verdict.evidence ?? ""}" (${r.verdict.verified ? "verified" : "unverified"})${r.verdict.note ? `; note: ${r.verdict.note}` : ""}`);
    }
    const provider = resolveProvider();
    if (provider !== "mock") {
      const file = path.join("docs", "evidence", "safety", "canary.json");
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, `${JSON.stringify({ ranAt: new Date().toISOString(), provider, rule: canaries.rule, results }, null, 2)}\n`);
      out(`Evidence written to ${file}`);
    }
    return results.every((r) => r.passed) ? 0 : 1;
  },
};
