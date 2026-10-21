import "server-only";
import "../../_lib/server";
import { notFound } from "next/navigation";
import { StaticReport } from "@/components/StaticReport";
import { readExampleRun } from "@/core/store/example";

export const dynamic = "force-dynamic";

/** A real run archived in docs/evidence/runs/, shown without a key (README troubleshooting). */
export default async function ExampleRunPage() {
  const example = await readExampleRun();
  if (!example) notFound();
  return <StaticReport summary={example.summary} details={example.details} note={example.note} />;
}
