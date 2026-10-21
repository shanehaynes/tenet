import "server-only";
import { buildRunResponse } from "@/core/pipeline/status";
import { handleError, json } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Run, rules, collisions, recent events and progress counters. Polled by the review, collisions and report pages. */
export async function GET(_request: Request, ctx: RouteContext<"/api/runs/[runId]">): Promise<Response> {
  try {
    const { runId } = await ctx.params;
    return json(await buildRunResponse(runId));
  } catch (err) {
    return handleError(err);
  }
}
