import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpotcheckClient } from "@/components/SpotcheckClient";
import { loadEnv } from "@/core/env";
import { SPOTCHECK_RUN_ID, spotcheckFileNames, spotcheckState } from "@/core/eval/spotcheck";

// Hand scoring for the judge spot check (evidence M05). Blind by construction: this page reads only the
// blank CSV and Shane's own CSV (the same two files as /api/spotcheck/[runId]), never a run's files, and
// links nowhere in the run.

loadEnv();

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Spot check · Tenet" };

async function readIfExists(file: string): Promise<string | null> {
  try {
    return await readFile(/*turbopackIgnore: true*/ file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export default async function SpotcheckPage({ params }: PageProps<"/spotcheck/[runId]">) {
  const { runId } = await params;
  if (!SPOTCHECK_RUN_ID.test(runId)) notFound();
  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.TENET_SPOTCHECK_DIR?.trim() || path.join(process.cwd(), "docs", "evidence", "spotcheck"));
  const names = spotcheckFileNames(runId);
  const blank = await readIfExists(path.join(dir, names.blank));
  if (blank === null) notFound();
  const { rows } = spotcheckState(blank, await readIfExists(path.join(dir, names.saved)));
  const savedFile = path.join(dir, names.saved);
  const relative = path.relative(/*turbopackIgnore: true*/ process.cwd(), savedFile);
  const savedPath = relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? relative : savedFile;
  return <SpotcheckClient runId={runId} initialRows={rows} savedPath={savedPath} />;
}
