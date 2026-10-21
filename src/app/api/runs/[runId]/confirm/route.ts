import "server-only";
import { confirmRun } from "@/core/pipeline/analysis";
import { handleError, json } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 409 unless every rule has an effective type or is parked; then maps collisions in the background (202). */
export async function POST(_request: Request, ctx: RouteContext<"/api/runs/[runId]/confirm">): Promise<Response> {
  try {
    const { runId } = await ctx.params;
    return json(await confirmRun(runId), 202);
  } catch (err) {
    return handleError(err);
  }
}
