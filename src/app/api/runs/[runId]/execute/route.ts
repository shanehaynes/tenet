import "server-only";
import { z } from "zod";
import { startExecution } from "@/core/pipeline/execution";
import { httpTarget } from "@/core/pipeline/runConfig";
import { handleError, json, readBody } from "../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ExecuteBody = z.object({
  spendCapUsd: z.number().positive().max(40).optional(),
  concurrency: z.number().int().min(1).max(16).optional(),
  rungs: z.union([z.literal(4), z.literal(6)]).optional(),
  flatComparison: z.boolean().optional(),
  dismiss: z.array(z.string()).optional(),
  /** The agent under test: the model (default) or an HTTP agent (architecture §4.6; URL defaults to TENET_AGENT_URL). */
  target: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("model") }),
      z.object({
        kind: z.literal("http"),
        url: z.url({ protocol: /^https?$/ }).optional(),
        agent: z.string().trim().max(80).optional(),
        name: z.string().trim().max(120).optional(),
      }),
    ])
    .optional(),
});

/** Starts generation, execution and judging (202). spendCapUsd is the test budget (architecture §7). */
export async function POST(request: Request, ctx: RouteContext<"/api/runs/[runId]/execute">): Promise<Response> {
  try {
    const { runId } = await ctx.params;
    const { target, ...body } = await readBody(request, ExecuteBody);
    if (target?.kind === "http") {
      const http = httpTarget(target);
      if (!http) return json({ error: { code: "bad_request", message: "Give the agent's URL (or set TENET_AGENT_URL)." } }, 400);
      return json(await startExecution(runId, { ...body, target: http }), 202);
    }
    return json(await startExecution(runId, body), 202);
  } catch (err) {
    return handleError(err);
  }
}
