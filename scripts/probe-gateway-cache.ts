import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { loadEnv } from "../src/core/env";
import { settings } from "../src/core/config";
import { PORTKEY_BASE_URL } from "../src/core/model/providers/openaiCompat";

// `npx tsx scripts/probe-gateway-cache.ts`: does the gateway replay identical requests from a response cache?
// Sends one small request twice, then once more with Portkey's force-refresh header, and records the
// cache-status header, latency and output of each. Writes docs/evidence/tokenomics/gateway-cache.md.
// (Found 2026-10-21: re-judging a run with identical settings returned identical verdicts in a tenth of the time.)

async function main(): Promise<number> {
  loadEnv();
  const key = process.env.PORTKEY_API_KEY?.trim();
  if (!key) {
    console.error("PORTKEY_API_KEY is not set; this probe is about the Portkey gateway.");
    return 1;
  }
  const client = new OpenAI({ apiKey: key, baseURL: PORTKEY_BASE_URL, defaultHeaders: { "x-portkey-api-key": key }, maxRetries: 0, timeout: 60_000 });
  const model = settings().targetModel;
  const body = {
    model,
    messages: [
      { role: "system" as const, content: "Answer with one word." },
      { role: "user" as const, content: `Name a color. (probe ${new Date().toISOString().slice(0, 13)})` },
    ],
    max_completion_tokens: 200,
  };
  const rows: { call: string; status: string; ms: number; text: string; outputTokens: number }[] = [];
  for (const [call, headers] of [
    ["first", {}],
    ["identical repeat at once", {}],
    ["identical repeat 10 s later", {}],
    ["repeat with x-portkey-cache-force-refresh", { "x-portkey-cache-force-refresh": "true" }],
  ] as const) {
    if (call.includes("10 s later")) await new Promise((r) => setTimeout(r, 10_000)); // the cache may be written asynchronously
    const started = Date.now();
    const { data, response } = await client.chat.completions.create(body, { headers }).withResponse();
    rows.push({
      call,
      status: response.headers.get("x-portkey-cache-status") ?? "(no header)",
      ms: Date.now() - started,
      text: data.choices[0]?.message?.content ?? "",
      outputTokens: data.usage?.completion_tokens ?? 0,
    });
  }
  const md = [
    "# Gateway response cache (Portkey)",
    "",
    `Measured ${new Date().toISOString()} with \`npx tsx scripts/probe-gateway-cache.ts\`, model ${model}. The same request sent three times (the third 10 s after the second, since the cache may be written asynchronously), then once with \`x-portkey-cache-force-refresh: true\`.`,
    "",
    "| Call | x-portkey-cache-status | ms | Output tokens | Reply |",
    "|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.call} | ${r.status} | ${r.ms} | ${r.outputTokens} | ${r.text.replace(/\|/g, "/").slice(0, 40)} |`),
    "",
  ].join("\n");
  console.log(md);
  const file = path.join("docs", "evidence", "tokenomics", "gateway-cache.md");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, md);
  console.log(`Written to ${file}`);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error((err as Error).message);
    process.exitCode = 1;
  });
