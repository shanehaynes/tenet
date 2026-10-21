import "server-only";
import { ZodError, type ZodType } from "zod";
import { loadEnv } from "@/core/env";
import { errorNamed } from "@/core/errors";
import type { RunStateError } from "@/core/pipeline/analysis";

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
  if (err instanceof ZodError || errorNamed(err, "ZodError")) {
    return errorJson(400, "invalid_request", (err as ZodError).issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  }
  const message = err instanceof Error ? err.message : String(err);
  if (errorNamed(err, "PolicyInputError")) return errorJson(400, "invalid_policy", message);
  if (errorNamed(err, "RunNotFound")) return errorJson(404, "not_found", message);
  if (errorNamed(err, "RunStateError")) {
    const code = (err as RunStateError).code;
    return errorJson(code === "not_found" ? 404 : 409, code, message);
  }
  if (errorNamed(err, "NoKeyError")) return errorJson(503, "no_key", message);
  if (errorNamed(err, "BudgetExceeded", "KeyBudgetExceeded", "GuardTripped")) return errorJson(409, "budget", message);
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
