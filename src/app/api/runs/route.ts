import "server-only";
import { z } from "zod";
import { startAnalysis } from "@/core/pipeline/analysis";
import { readPolicy } from "@/core/store/policies";
import { listRuns } from "@/core/store/runs";
import { errorJson, handleError, json, readBody } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return json(await listRuns());
  } catch (err) {
    return handleError(err);
  }
}

const CreateRun = z.object({ policyId: z.string().min(1) });

/** Starts analysis (scan → decompose → classify) and returns 202; the UI polls GET /api/runs/:id. */
export async function POST(request: Request): Promise<Response> {
  try {
    const { policyId } = await readBody(request, CreateRun);
    const policy = await readPolicy(policyId).catch(() => null);
    if (!policy) return errorJson(404, "not_found", `Policy ${policyId} not found`);
    if (policy.flagged) {
      return errorJson(409, "quarantined", "This policy is quarantined by the injection scanner. Edit the text and re-scan it first.");
    }
    return json(await startAnalysis(policy), 202);
  } catch (err) {
    return handleError(err);
  }
}
