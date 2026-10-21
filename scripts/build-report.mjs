// `node scripts/build-report.mjs [--allow-missing M05,M17]`: fills report/report.src.html from
// docs/evidence/report-data.json, inlines report/report.css and every screenshot as a data URI, and writes
// report.html at the repo root (one file that opens offline by double-click). Fails on any unfilled
// placeholder unless its measurement is allowed to be missing.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const allowIdx = args.indexOf("--allow-missing");
const allowed = allowIdx >= 0 ? args[allowIdx + 1].split(",").map((s) => s.trim()) : [];
const data = JSON.parse(readFileSync("docs/evidence/report-data.json", "utf8"));
let html = readFileSync("report/report.src.html", "utf8")
  .replace(/<!--[\s\S]*?-->\n?/g, "")
  .replace("/*{{CSS}}*/", readFileSync("report/report.css", "utf8"));

const problems = [];
html = html.replace(/\{\{([A-Za-z0-9_.-]+)\}\}/g, (_, key) => {
  const v = data.values[key];
  if (v) return v.value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const measurement = key.split(".")[0];
  if (allowed.includes(measurement)) return `<span class="draft">[${key}: pending]</span>`;
  problems.push(`missing value {{${key}}}`);
  return `{{${key}}}`;
});
html = html.replace(/<img data-evidence="([^"]+)"/g, (_, id) => {
  const file = path.join("docs", "evidence", "screenshots", `${id}.png`);
  if (!existsSync(file)) {
    problems.push(`missing screenshot ${id}`);
    return `<img data-evidence="${id}"`;
  }
  return `<img src="data:image/png;base64,${readFileSync(file).toString("base64")}"`;
});

if (problems.length) {
  console.error(`build-report: ${problems.length} problem(s)\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
writeFileSync("report.html", html);
console.log(`report.html written (${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB).`);
