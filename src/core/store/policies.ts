import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { newId, nowIso } from "../ids";
import type { ScanResult } from "../schemas/agents";
import { Policy, type SampleInfo } from "../schemas/records";
import { dataDir, readJson, writeJsonAtomic } from "./fs";

// Policies on disk (data/policies/<id>.json) and the sample catalog (samples/*.md).

export type SampleEntry = SampleInfo & { name: string; file: string; description: string };

/** Samples shown on the Policies page, in display order. The edge mission statement is for tests only. */
export const SAMPLE_CATALOG: SampleEntry[] = [
  {
    key: "harrow-vale",
    name: "Harrow & Vale LLP",
    role: "fictional",
    file: "harrow-vale.md",
    description: "Accounting firm client-service assistant; the demo policy (13 rules).",
  },
  {
    key: "meridian-health",
    name: "Meridian Health Partners",
    role: "fictional",
    file: "meridian-health.md",
    description: "Patient-access assistant for an outpatient group (12 rules).",
  },
  {
    key: "northgate-it",
    name: "Northgate Systems IT",
    role: "fictional",
    file: "northgate-it.md",
    description: "Internal IT help-desk assistant (11 rules).",
  },
  {
    key: "campus-customs-hw5",
    name: "Campus Customs (HW5)",
    role: "real_agent",
    file: "campus-customs-hw5.md",
    description: "Rules of a real five-agent back-office team (17 rules).",
  },
  {
    key: "openai-model-spec-excerpt",
    name: "OpenAI Model Spec (excerpt)",
    role: "published",
    file: "openai-model-spec-excerpt.md",
    description: "22 normative sentences from a published model policy (CC0).",
  },
  {
    key: "harrow-vale-injected",
    name: "Harrow & Vale LLP (injected)",
    role: "safety_demo",
    file: "harrow-vale-injected.md",
    description: "The demo policy with one injected line; should be quarantined.",
  },
];

export function samplesDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.TENET_SAMPLES_DIR?.trim() || path.join(process.cwd(), "samples"));
}

export async function readSampleText(entry: Pick<SampleEntry, "file">): Promise<string> {
  return readFile(/*turbopackIgnore: true*/ path.join(samplesDir(), entry.file), "utf8");
}

function policiesDir(): string {
  return path.join(dataDir(), "policies");
}

function policyPath(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`Invalid policy id ${id}`);
  return path.join(policiesDir(), `${id}.json`);
}

export async function createPolicy(input: {
  name: string;
  text: string;
  source: Policy["source"];
  sample?: SampleInfo | null;
  scan: ScanResult | null;
}): Promise<Policy> {
  const policy: Policy = Policy.parse({
    id: newId(),
    name: input.name,
    text: input.text,
    source: input.source,
    sample: input.sample ?? null,
    flagged: input.scan?.flagged ?? false,
    scan: input.scan,
    createdAt: nowIso(),
  });
  await writeJsonAtomic(policyPath(policy.id), policy);
  return policy;
}

export async function updatePolicy(policy: Policy): Promise<void> {
  await writeJsonAtomic(policyPath(policy.id), Policy.parse(policy));
}

export async function readPolicy(id: string): Promise<Policy | null> {
  return readJson(policyPath(id), Policy);
}

export async function listPolicies(): Promise<Policy[]> {
  let files: string[];
  try {
    files = await readdir(policiesDir());
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: Policy[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const p = await readJson(path.join(policiesDir(), f), Policy).catch(() => null);
    if (p) out.push(p);
  }
  const order = new Map(SAMPLE_CATALOG.map((s, i) => [s.key, i]));
  return out.sort((a, b) => {
    const sa = a.sample ? (order.get(a.sample.key) ?? 99) : 100;
    const sb = b.sample ? (order.get(b.sample.key) ?? 99) : 100;
    return sa - sb || b.createdAt.localeCompare(a.createdAt);
  });
}

export async function findSamplePolicy(key: string): Promise<Policy | null> {
  return (await listPolicies()).find((p) => p.sample?.key === key) ?? null;
}
