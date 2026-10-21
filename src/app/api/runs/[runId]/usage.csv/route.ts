import "server-only";
import { usageCsv } from "@/core/report/csv";
import { readRun } from "@/core/store/runs";
import { readRunUsage } from "@/core/store/usage";
import { handleError } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every logged model call of the run, one row per attempt (PRD Req. 11). */
export async function GET(_request: Request, ctx: RouteContext<"/api/runs/[runId]/usage.csv">): Promise<Response> {
  try {
    const { runId } = await ctx.params;
    await readRun(runId);
    return new Response(usageCsv(await readRunUsage(runId)), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="tenet-usage-${runId}.csv"` },
    });
  } catch (err) {
    return handleError(err);
  }
}
