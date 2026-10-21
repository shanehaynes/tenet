import "server-only";
import { applyRuleOps, RuleOps } from "@/core/pipeline/review";
import { handleError, json, readBody } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Overrides while the run awaits review: set_type, park, unpark, split, merge (applied in order). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/runs/[runId]/rules">): Promise<Response> {
  try {
    const { runId } = await ctx.params;
    const { ops } = await readBody(request, RuleOps);
    return json(await applyRuleOps(runId, ops));
  } catch (err) {
    return handleError(err);
  }
}
