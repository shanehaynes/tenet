import "server-only";
import { CollisionPatch, patchCollisions } from "@/core/pipeline/review";
import { handleError, json, readBody } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dismiss or restore proposed collisions before tests run. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/runs/[runId]/collisions">): Promise<Response> {
  try {
    const { runId } = await ctx.params;
    const patch = await readBody(request, CollisionPatch);
    return json(await patchCollisions(runId, patch));
  } catch (err) {
    return handleError(err);
  }
}
