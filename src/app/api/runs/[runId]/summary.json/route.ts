import "server-only";
import { readOrComputeSummary } from "@/core/pipeline/summary";
import { handleError, json } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The run's Summary: saved once finished, computed live while tests run (the live report polls this). */
export async function GET(_request: Request, ctx: RouteContext<"/api/runs/[runId]/summary.json">): Promise<Response> {
  try {
    const { runId } = await ctx.params;
    return json(await readOrComputeSummary(runId));
  } catch (err) {
    return handleError(err);
  }
}
