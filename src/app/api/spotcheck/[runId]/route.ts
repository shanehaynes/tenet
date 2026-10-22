import "server-only";
import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { countScored, mergeHumanVerdicts, rowsToCsv, SPOTCHECK_RUN_ID, spotcheckFileNames, spotcheckState, validateHumanVerdicts } from "@/core/eval/spotcheck";
import { errorJson, handleError, json, readBody } from "../../_lib/http";

// Hand scoring for the judge spot check (evidence M05). Blind by construction: this route reads only
// `<runId>-blank.csv` and Shane's `<runId>-shane.csv` in the spot-check directory, never a run's files.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PutBody = z.object({
  rows: z
    .array(
      z.object({
        scenarioId: z.string().min(1).max(200),
        human_verdict: z.string().max(40),
        human_note: z.string().max(4000).optional(),
      }),
    )
    .max(1000),
});

/** docs/evidence/spotcheck, or TENET_SPOTCHECK_DIR (read per request so tests never write into the repo). */
function spotcheckDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.TENET_SPOTCHECK_DIR?.trim() || path.join(process.cwd(), "docs", "evidence", "spotcheck"));
}

async function readIfExists(file: string): Promise<string | null> {
  try {
    return await readFile(/*turbopackIgnore: true*/ file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function load(runId: string) {
  const dir = spotcheckDir();
  const names = spotcheckFileNames(runId);
  const blank = await readIfExists(path.join(dir, names.blank));
  if (blank === null) return null;
  const saved = await readIfExists(path.join(dir, names.saved));
  return { savedFile: path.join(dir, names.saved), ...spotcheckState(blank, saved) };
}

/** Write to a temp file beside the target, then rename, so a crash never leaves half a CSV. */
async function writeAtomic(file: string, text: string): Promise<void> {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    await writeFile(/*turbopackIgnore: true*/ tmp, text, "utf8");
    await rename(/*turbopackIgnore: true*/ tmp, file);
  } catch (err) {
    await unlink(/*turbopackIgnore: true*/ tmp).catch(() => undefined);
    throw err;
  }
}

/** One read-merge-write at a time per run, so two quick saves cannot drop each other's answers. */
const queues = new Map<string, Promise<unknown>>();
function serialized<T>(key: string, task: () => Promise<T>): Promise<T> {
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(task);
  queues.set(key, next);
  const done = () => {
    if (queues.get(key) === next) queues.delete(key);
  };
  next.then(done, done);
  return next;
}

function badRunId(runId: string): Response {
  return errorJson(400, "invalid_request", `Not a run id: "${runId}"`);
}

function noSpotcheck(runId: string): Response {
  return errorJson(404, "not_found", `No spot check exported for run ${runId}. Run: npm run tenet -- spotcheck export ${runId}`);
}

/** The blank rows with Shane's saved verdicts and notes merged in. */
export async function GET(_request: Request, ctx: RouteContext<"/api/spotcheck/[runId]">): Promise<Response> {
  try {
    const { runId } = await ctx.params;
    if (!SPOTCHECK_RUN_ID.test(runId)) return badRunId(runId);
    const state = await load(runId);
    if (!state) return noSpotcheck(runId);
    return json({ runId, rows: state.rows, saved: state.saved });
  } catch (err) {
    return handleError(err);
  }
}

/** Saves verdicts and notes (all rows or only changed ones) into `<runId>-shane.csv`, in the blank file's order. */
export async function PUT(request: Request, ctx: RouteContext<"/api/spotcheck/[runId]">): Promise<Response> {
  try {
    const { runId } = await ctx.params;
    if (!SPOTCHECK_RUN_ID.test(runId)) return badRunId(runId);
    const body = await readBody(request, PutBody);
    return await serialized(runId, async () => {
      const state = await load(runId);
      if (!state) return noSpotcheck(runId);
      const problems = validateHumanVerdicts(state.rows, body.rows);
      if (problems.length) return errorJson(400, "invalid_verdict", problems.join("; "));
      const rows = mergeHumanVerdicts(state.rows, body.rows);
      await writeAtomic(state.savedFile, rowsToCsv(rows));
      return json({ runId, saved: countScored(rows), total: rows.length });
    });
  } catch (err) {
    return handleError(err);
  }
}
