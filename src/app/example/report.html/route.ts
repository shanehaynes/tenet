import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readExampleRun } from "@/core/store/example";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The archived example run's standalone report, as committed. */
export async function GET(): Promise<Response> {
  const example = await readExampleRun();
  if (!example) return new Response("No example run", { status: 404 });
  const file = path.join(/*turbopackIgnore: true*/ process.cwd(), "docs", "evidence", "runs", example.runId, "report.html");
  const html = await readFile(file, "utf8").catch(() => null);
  if (!html) return new Response("No exported report for the example run", { status: 404 });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "content-disposition": `attachment; filename="tenet-example-report.html"` } });
}
