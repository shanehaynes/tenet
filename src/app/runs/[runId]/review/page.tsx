import "server-only";
import { loadRunOr404 } from "../../../_lib/server";
import { ReviewClient } from "@/components/ReviewClient";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: PageProps<"/runs/[runId]/review">) {
  const { runId } = await params;
  return <ReviewClient initial={await loadRunOr404(runId)} />;
}
