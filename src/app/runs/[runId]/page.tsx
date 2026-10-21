import "server-only";
import { redirect } from "next/navigation";
import { loadRunOr404 } from "../../_lib/server";
import { stepFor } from "@/components/RunStepper";

export const dynamic = "force-dynamic";

/** Sends a run link to the page for its current step. */
export default async function RunPage({ params }: PageProps<"/runs/[runId]">) {
  const { runId } = await params;
  const step = stepFor((await loadRunOr404(runId)).run.status);
  redirect(step <= 1 ? `/runs/${runId}/review` : step === 2 ? `/runs/${runId}/collisions` : `/runs/${runId}/report`);
}
