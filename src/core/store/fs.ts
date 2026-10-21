import { randomBytes } from "node:crypto";
import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ZodType } from "zod";
import { settings } from "../config";

/** The data directory, read at call time so tests can point TENET_DATA_DIR at a temp dir. */
export function dataDir(): string {
  return settings().dataDir;
}

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === "ENOENT";
}

export async function readJson<T>(file: string, schema?: ZodType<T>): Promise<T | null> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
  const value = JSON.parse(raw) as unknown;
  return schema ? schema.parse(value) : (value as T);
}

const RETRYABLE_RENAME = new Set(["EPERM", "EBUSY", "EACCES"]);

/** Writes to a unique temp file and renames it into place, so readers never see a half-written file. */
export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(tmp, file);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? "";
      if (!RETRYABLE_RENAME.has(code) || attempt >= 3) {
        await rm(tmp, { force: true });
        throw err;
      }
      await new Promise((r) => setTimeout(r, 25 * (attempt + 1))); // Windows: a reader may hold the target open
    }
  }
}

/** Appends one JSON line. Small appends are atomic with O_APPEND, so concurrent writers need no queue. */
export async function appendJsonl(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(value)}\n`, "utf8");
}

/** Reads a JSON-lines file, skipping lines that do not parse (a torn last line after a crash). */
export async function readJsonl<T>(file: string, schema?: ZodType<T>): Promise<T[]> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (err) {
    if (isNotFound(err)) return [];
    throw err;
  }
  const out: T[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line) as unknown;
      if (schema) {
        const parsed = schema.safeParse(value);
        if (parsed.success) out.push(parsed.data);
      } else {
        out.push(value as T);
      }
    } catch {
      // torn or partial line: skip
    }
  }
  return out;
}
