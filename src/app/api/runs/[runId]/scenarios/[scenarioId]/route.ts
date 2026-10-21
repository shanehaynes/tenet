import "server-only";
import { readRunFile, readTranscript } from "@/core/store/runs";
import { errorJson, handleError, json } from "../../../../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Scenario, transcript and verdict for the transcript drawer. */
export async function GET(_request: Request, ctx: RouteContext<"/api/runs/[runId]/scenarios/[scenarioId]">): Promise<Response> {
  try {
    const { runId, scenarioId } = await ctx.params;
    const scenario = (await readRunFile(runId, "scenarios")).find((s) => s.id === scenarioId);
    if (!scenario) return errorJson(404, "not_found", `Scenario ${scenarioId} not found`);
    const [transcript, verdicts] = await Promise.all([readTranscript(runId, scenarioId), readRunFile(runId, "verdicts")]);
    return json({ scenario, transcript, verdict: verdicts.find((v) => v.scenarioId === scenarioId) ?? null });
  } catch (err) {
    return handleError(err);
  }
}
