import "server-only";
import { z } from "zod";
import { ensureSamples, ingestPolicy, MAX_POLICY_BYTES, PolicyInputError } from "@/core/pipeline/policies";
import { handleError, json, readBody } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Policies without their text; samples are seeded (and scanned) on first read. */
export async function GET(): Promise<Response> {
  try {
    const policies = await ensureSamples();
    return json(policies.map(({ text, ...rest }) => ({ ...rest, chars: text.length })));
  } catch (err) {
    return handleError(err);
  }
}

const PasteBody = z.object({ name: z.string().max(200).default(""), text: z.string() });

/** Paste (JSON {name, text}) or upload (multipart with a .txt or .md file). Runs the scanner immediately. */
export async function POST(request: Request): Promise<Response> {
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.startsWith("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new PolicyInputError("Attach a .txt or .md file.");
      if (!/\.(txt|md|markdown)$/i.test(file.name)) throw new PolicyInputError("Only .txt and .md files are accepted.");
      if (file.size > MAX_POLICY_BYTES) throw new PolicyInputError("The file is larger than 200 KB.");
      const name = String(form.get("name") ?? "").trim() || file.name.replace(/\.(txt|md|markdown)$/i, "");
      return json(await ingestPolicy({ name, text: await file.text(), source: "upload" }), 201);
    }
    const body = await readBody(request, PasteBody);
    return json(await ingestPolicy({ name: body.name, text: body.text, source: "paste" }), 201);
  } catch (err) {
    return handleError(err);
  }
}
