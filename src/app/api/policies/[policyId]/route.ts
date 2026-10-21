import "server-only";
import { readPolicy } from "@/core/store/policies";
import { errorJson, handleError, json } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: RouteContext<"/api/policies/[policyId]">): Promise<Response> {
  try {
    const { policyId } = await ctx.params;
    const policy = await readPolicy(policyId).catch(() => null);
    return policy ? json(policy) : errorJson(404, "not_found", `Policy ${policyId} not found`);
  } catch (err) {
    return handleError(err);
  }
}
