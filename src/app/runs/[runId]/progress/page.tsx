import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** The progress view is the live report's header (architecture §9). */
export default async function ProgressPage({ params }: PageProps<"/runs/[runId]/progress">) {
  const { runId } = await params;
  redirect(`/runs/${runId}/report`);
}
