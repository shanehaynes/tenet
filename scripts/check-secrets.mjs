// `node scripts/check-secrets.mjs` (CI and before publishing): fails if an .env file is tracked, if
// .env.example carries a value, or if any tracked file contains something that looks like a key. When a key
// is available locally (./.env or ../.env), it also searches the tracked files for that exact value.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const problems = [];

for (const f of files) {
  const base = path.basename(f);
  if (base.startsWith(".env") && base !== ".env.example") problems.push(`${f}: an env file is tracked`);
}

if (existsSync(".env.example")) {
  for (const [i, line] of readFileSync(".env.example", "utf8").split("\n").entries()) {
    const m = line.match(/^\s*([A-Z_]+_KEY)\s*=\s*([^#\s]+)/);
    if (m) problems.push(`.env.example:${i + 1}: ${m[1]} has a value`);
  }
}

const PATTERNS = [
  { name: "OpenAI-style key", re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/ },
  { name: "key assignment with a value", re: /\b(PORTKEY|OPENAI)_API_KEY\s*=\s*["']?[A-Za-z0-9+/_=-]{20,}/ },
  { name: "bearer token", re: /\bBearer\s+[A-Za-z0-9._~+/-]{24,}/ },
];

const secrets = [];
for (const envFile of [".env", "../.env"]) {
  if (!existsSync(envFile)) continue;
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*(PORTKEY_API_KEY|OPENAI_API_KEY)\s*=\s*["']?([^"'\s#]+)/);
    if (m && m[2].length >= 8) secrets.push(m[2]);
  }
}

for (const f of files) {
  if (!existsSync(f)) continue;
  let text;
  try {
    const buf = readFileSync(f);
    if (buf.includes(0)) continue; // binary
    text = buf.toString("utf8");
  } catch {
    continue;
  }
  for (const p of PATTERNS) {
    const m = text.match(p.re);
    if (m) problems.push(`${f}: ${p.name} (${m[0].slice(0, 12)}…)`);
  }
  for (const s of secrets) if (text.includes(s)) problems.push(`${f}: contains the local API key value`);
}

if (problems.length) {
  console.error(`check-secrets: ${problems.length} problem(s)\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`check-secrets: ${files.length} tracked files clean${secrets.length ? " (including a search for the local key value)" : ""}.`);
