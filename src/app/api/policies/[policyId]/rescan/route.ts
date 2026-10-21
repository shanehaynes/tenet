import "server-only";
import { z } from "zod";
import { rescanPolicy } from "@/core/pipeline/policies";
import { handleError, json, readBody } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Edit and re-scan: the only way out of quarantine (agents §1). */
export async function POST(request: Request, ctx: RouteContext<"/api/policies/[policyId]/rescan">): Promise<Response> {
  try {
    const { policyId } = await ctx.params;
    const { text } = await readBody(request, z.object({ text: z.string() }));
    return json(await rescanPolicy(policyId, text));
  } catch (err) {
    return handleError(err);
  }
}
