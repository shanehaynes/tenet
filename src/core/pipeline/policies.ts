import path from "node:path";
import { scanPolicy } from "../agents/scanner";
import type { Policy } from "../schemas/records";
import {
  createPolicy,
  findSamplePolicy,
  listPolicies,
  readPolicy,
  readSampleText,
  SAMPLE_CATALOG,
  updatePolicy,
  type SampleEntry,
} from "../store/policies";

// Policy ingest (PRD Req. 1): validate, scan for injections, store. The scanner runs on creation, so a
// flagged policy is quarantined before any run exists.

export const MAX_POLICY_BYTES = 200 * 1024;

export class PolicyInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyInputError";
  }
}

export function validatePolicyText(text: string): string {
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (!trimmed) throw new PolicyInputError("Paste or upload a policy first: the text is empty.");
  if (Buffer.byteLength(trimmed, "utf8") > MAX_POLICY_BYTES) {
    throw new PolicyInputError("The policy is larger than 200 KB. Paste the rules section only.");
  }
  return `${trimmed}\n`;
}

export async function ingestPolicy(input: {
  name: string;
  text: string;
  source: Policy["source"];
  sample?: SampleEntry | null;
}): Promise<Policy> {
  const text = validatePolicyText(input.text);
  const name = input.name.trim() || text.match(/^#\s+(.+)$/m)?.[1]?.trim() || "Untitled policy";
  const scan = await scanPolicy(text);
  return createPolicy({
    name,
    text,
    source: input.source,
    sample: input.sample ? { key: input.sample.key, role: input.sample.role } : null,
    scan,
  });
}

/** Edit-and-rescan: the only way out of quarantine. */
export async function rescanPolicy(id: string, text: string): Promise<Policy> {
  const policy = await readPolicy(id);
  if (!policy) throw new PolicyInputError(`Policy ${id} not found`);
  const clean = validatePolicyText(text);
  const scan = await scanPolicy(clean);
  const next: Policy = { ...policy, text: clean, scan, flagged: scan.flagged };
  await updatePolicy(next);
  return next;
}

let seeding: Promise<void> | null = null;

/**
 * Stores any sample not yet stored, or whose file has changed since it was stored (scanning each once), so
 * Analyze always uses the current sample text. Earlier versions stay stored, because their runs refer to them.
 * Concurrent callers share one seeding pass.
 */
export async function ensureSamples(): Promise<Policy[]> {
  seeding ??= (async () => {
    try {
      for (const entry of SAMPLE_CATALOG) {
        const text = await readSampleText(entry);
        const stored = await findSamplePolicy(entry.key);
        if (stored && stored.text.trim() === text.trim()) continue;
        await ingestPolicy({ name: entry.name, text, source: "sample", sample: entry });
      }
    } finally {
      seeding = null;
    }
  })();
  await seeding;
  return listPolicies();
}

/** One policy per sample (the newest version) plus every non-sample policy, in listing order. */
export function currentPolicies(policies: Policy[]): Policy[] {
  const seen = new Set<string>();
  return policies.filter((p) => {
    if (!p.sample) return true;
    const newest = [...policies].filter((q) => q.sample?.key === p.sample!.key).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (seen.has(p.sample.key) || newest.id !== p.id) return false;
    seen.add(p.sample.key);
    return true;
  });
}

/** The catalog entry for a file path under samples/, if it is one. */
export function sampleForFile(file: string): SampleEntry | null {
  const base = path.basename(file);
  return SAMPLE_CATALOG.find((s) => s.file === base) ?? null;
}

/** The stored policy for a sample (seeding just that one), or a new policy for any other file. */
export async function policyForFile(file: string, text: string, name?: string): Promise<Policy> {
  const sample = sampleForFile(file);
  if (sample) {
    const existing = await findSamplePolicy(sample.key);
    if (existing && existing.text.trim() === text.trim()) return existing;
    return ingestPolicy({ name: sample.name, text, source: "sample", sample });
  }
  return ingestPolicy({ name: name ?? path.basename(file).replace(/\.(md|txt)$/i, ""), text, source: "upload" });
}
