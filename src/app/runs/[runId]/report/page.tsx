import "server-only";
import { loadRunOr404 } from "../../../_lib/server";
import { LiveReport } from "@/components/LiveReport";
import { readOrComputeSummary } from "@/core/pipeline/summary";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: PageProps<"/runs/[runId]/report">) {
  const { runId } = await params;
  const run = await loadRunOr404(runId);
  const summary = await readOrComputeSummary(runId);
  return <LiveReport initialRun={run} initialSummary={summary} />;
}
