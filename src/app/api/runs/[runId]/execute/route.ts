import "server-only";
import { z } from "zod";
import { startExecution } from "@/core/pipeline/execution";
import { handleError, json, readBody } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ExecuteBody = z.object({
  spendCapUsd: z.number().positive().max(40).optional(),
  concurrency: z.number().int().min(1).max(16).optional(),
  rungs: z.union([z.literal(4), z.literal(6)]).optional(),
  flatComparison: z.boolean().optional(),
  dismiss: z.array(z.string()).optional(),
});

/** Starts generation, execution and judging (202). spendCapUsd is the test budget (architecture §7). */
export async function POST(request: Request, ctx: RouteContext<"/api/runs/[runId]/execute">): Promise<Response> {
  try {
    const { runId } = await ctx.params;
    const body = await readBody(request, ExecuteBody);
    return json(await startExecution(runId, body), 202);
  } catch (err) {
    return handleError(err);
  }
}
