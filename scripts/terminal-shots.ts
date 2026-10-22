import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

// `npx tsx scripts/terminal-shots.ts [--only S16]`: the terminal screenshots the report cites (S15 smoke test,
// S16 doctor finding .env one folder up, S17 the judge canary). Each command is run live, its output is
// cleaned (ANSI codes stripped, the masked key replaced entirely, the home folder shown as ~), rendered as a
// terminal and captured. The text is saved beside each image so the screenshot can be checked against it.

const SHOTS = [
  { id: "S15-smoke", show: "npm run smoke", args: ["run", "-s", "smoke"] },
  { id: "S16-doctor", show: "npm run doctor", args: ["run", "-s", "doctor"] },
  { id: "S17-canary", show: "npm run tenet -- canary", args: ["run", "-s", "tenet", "--", "canary"] },
];

const OUT = path.join("docs", "evidence", "screenshots");

function clean(text: string): string {
  return text
    .replace(/\x1b\[[0-9;]*m/g, "") // ANSI colors
    .replace(/\*{4,}\S{0,4}/g, "(set, hidden)") // maskKey shows the last four characters; hide them too
    .split(homedir())
    .join("~")
    .trimEnd();
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function main(): Promise<number> {
  const { values } = parseArgs({ args: process.argv.slice(2), options: { only: { type: "string" } } });
  const chosen = SHOTS.filter((s) => !values.only || s.id.startsWith(values.only));
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const shot of chosen) {
      const res = spawnSync("npm", shot.args, { encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" }, timeout: 300_000 });
      const text = clean(`${res.stdout ?? ""}${res.stderr ?? ""}`);
      writeFileSync(path.join(OUT, `${shot.id}.txt`), `$ ${shot.show}\n${text}\n`);
      const html = `<!doctype html><meta charset="utf-8"><style>
        body { margin: 0; background: #f4f4f5; padding: 24px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
        .term { background: #18181b; color: #e4e4e7; border-radius: 10px; padding: 18px 22px; display: inline-block; min-width: 760px; max-width: 1200px; }
        .bar { color: #a1a1aa; font-size: 12px; margin-bottom: 10px; }
        pre { margin: 0; font-size: 13px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
        .prompt { color: #86efac; }
      </style><div class="term"><div class="bar">~/projects/Tenet</div><pre><span class="prompt">$ ${escapeHtml(shot.show)}</span>\n${escapeHtml(text)}</pre></div>`;
      const page = await browser.newPage({ viewport: { width: 1300, height: 800 }, deviceScaleFactor: 1 });
      await page.setContent(html);
      await page.locator(".term").screenshot({ path: path.join(OUT, `${shot.id}.png`) });
      await page.close();
      console.log(`${shot.id}: exit ${res.status}, ${text.split("\n").length} lines`);
    }
  } finally {
    await browser.close();
  }
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
