import "server-only";
import { notFound } from "next/navigation";
import { loadEnv } from "@/core/env";
import { buildRunResponse, type RunResponse } from "@/core/pipeline/status";
import { errorNamed } from "@/core/errors";

// Imported by every server page before it touches the store or the model: loads ./.env then ../.env.
loadEnv();

/** The run's page data, or the 404 page for an unknown run id. */
export async function loadRunOr404(runId: string): Promise<RunResponse> {
  const data = await buildRunResponse(runId).catch((err: unknown) => {
    if (errorNamed(err, "RunNotFound")) return null;
    throw err;
  });
  if (!data) notFound();
  return data;
}
