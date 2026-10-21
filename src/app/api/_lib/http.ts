import "server-only";
import { ZodError, type ZodType } from "zod";
import { loadEnv, NoKeyError } from "@/core/env";
import { RunStateError } from "@/core/pipeline/analysis";
import { PolicyInputError } from "@/core/pipeline/policies";
import { RunNotFound } from "@/core/store/runs";

// Shared helpers for route handlers (architecture §8): load env once, validate bodies with zod, and map
// domain errors to { error: { code, message } } with 400/404/409/503.

loadEnv();

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function errorJson(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export function handleError(err: unknown): Response {
  if (err instanceof ZodError) {
    return errorJson(400, "invalid_request", err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  }
  if (err instanceof PolicyInputError) return errorJson(400, "invalid_policy", err.message);
  if (err instanceof RunNotFound) return errorJson(404, "not_found", err.message);
  if (err instanceof RunStateError) {
    return errorJson(err.code === "not_found" ? 404 : 409, err.code, err.message);
  }
  if (err instanceof NoKeyError) return errorJson(503, "no_key", err.message);
  console.error(err);
  return errorJson(500, "internal", err instanceof Error ? err.message : String(err));
}

export async function readBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ZodError([{ code: "custom", path: [], message: "Body must be JSON", input: undefined }]);
  }
  return schema.parse(raw);
}
