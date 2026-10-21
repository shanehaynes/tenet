// `node scripts/build-slides.mjs`: fills slides/slides.src.html from docs/evidence/report-data.json, inlines
// screenshots as data URIs and writes slides.html at the repo root (reveal.js loads from the pinned CDN, as
// the course requires).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const data = JSON.parse(readFileSync("docs/evidence/report-data.json", "utf8"));
const problems = [];
let html = readFileSync("slides/slides.src.html", "utf8").replace(/<!--[\s\S]*?-->\n?/g, "");
html = html.replace(/\{\{([A-Za-z0-9_.-]+)\}\}/g, (_, key) => {
  if (data.values[key]) return data.values[key].value;
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
  console.error(`build-slides: ${problems.join("; ")}`);
  process.exit(1);
}
writeFileSync("slides.html", html);
const count = (html.match(/<section>/g) ?? []).length;
console.log(`slides.html written: ${count} slides, ${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB.`);
