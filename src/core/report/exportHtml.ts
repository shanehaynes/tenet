import { createElement, type ReactElement } from "react";
import type { Transcript } from "../schemas/records";
import type { Summary } from "../schemas/summary";
import { ReportDocument } from "./ReportDocument";
import { reportCss } from "./reportCss";

// Standalone report export (architecture §10; PRD Req. 10): one HTML file with the report's own CSS inlined
// and every cited transcript inlined in <details>, so it opens by double-click with no network and no app.
// The caller supplies renderToStaticMarkup: the CLI uses react-dom/server, a route handler react-dom/server.edge
// (the plain entry throws under the App Router's react-server bundling).

export type RenderFn = (element: ReactElement) => string;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function exportHtml(render: RenderFn, summary: Summary, transcripts: Record<string, Transcript>): string {
  const body = render(createElement(ReportDocument, { summary, transcripts }));
  const generated = new Date(summary.generatedAt).toISOString().slice(0, 16).replace("T", " ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tenet report: ${escapeHtml(summary.policyName)}</title>
<style>
body { margin: 0; padding: 32px 20px 48px; background: #fafafa; }
.tr-export-foot { max-width: 980px; margin: 32px auto 0; color: #71717a; font: 12px ui-sans-serif, system-ui, sans-serif; }
${reportCss}
</style>
</head>
<body>
${body}
<script>
// Print every folded section, and open the one a link points to.
addEventListener("beforeprint", () => document.querySelectorAll("details").forEach((d) => (d.open = true)));
function openTarget() { const t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); for (let e = t; e; e = e.parentElement) if (e.tagName === "DETAILS") e.open = true; }
addEventListener("hashchange", openTarget); openTarget();
</script>
<p class="tr-export-foot">Exported from Tenet, run ${escapeHtml(summary.runId)}, summary generated ${escapeHtml(generated)} UTC. Every number above is computed from the run's logged model calls; cost is logged tokens × published list price.</p>
</body>
</html>
`;
}
