import "server-only";
import { defaultLedger } from "@/core/model/client";
import { confirmBlockers } from "@/core/pipeline/analysis";
import { readRunView } from "@/core/pipeline/status";
import { handleError, json } from "../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Run, rules, collisions, recent events and progress. Polled every second by the review and progress pages. */
export async function GET(_request: Request, ctx: RouteContext<"/api/runs/[runId]">): Promise<Response> {
  try {
    const { runId } = await ctx.params;
    const view = await readRunView(runId);
    const classified = view.rules.filter((r) => r.proposedType !== null || r.rationale !== null).length;
    return json({
      ...view,
      progress: {
        rulesTotal: view.rules.length,
        rulesClassified: classified,
        confirmBlockers: view.run.status === "awaiting_review" ? confirmBlockers(view.rules, view.run.config.ambiguityThreshold) : [],
        spend: defaultLedger().snapshot(runId),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
