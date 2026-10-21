import "server-only";
import { readAllTranscripts, readOrComputeSummary } from "@/core/pipeline/summary";
import { exportHtml } from "@/core/report/exportHtml";
import { handleError } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The standalone report: one HTML file with CSS and transcripts inlined (architecture §10). */
export async function GET(_request: Request, ctx: RouteContext<"/api/runs/[runId]/report.html">): Promise<Response> {
  try {
    const { runId } = await ctx.params;
    const [summary, transcripts] = await Promise.all([readOrComputeSummary(runId), readAllTranscripts(runId)]);
    const { renderToStaticMarkup } = await import("react-dom/server.edge");
    const html = exportHtml(renderToStaticMarkup, summary, transcripts);
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": `attachment; filename="tenet-report-${runId}.html"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
