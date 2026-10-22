import "server-only";
import "./_lib/server";
import { PolicyHome, type PolicyItem } from "@/components/PolicyHome";
import { currentPolicies, ensureSamples } from "@/core/pipeline/policies";
import { listPolicies, SAMPLE_CATALOG } from "@/core/store/policies";

export const dynamic = "force-dynamic";

export default async function Home() {
  let error: string | null = null;
  let policies;
  try {
    policies = await ensureSamples();
  } catch (e) {
    error = (e as Error).message;
    policies = await listPolicies();
  }
  const catalog = new Map(SAMPLE_CATALOG.map((s) => [s.key, s]));
  // A sample whose file changed is stored again; older versions keep their runs but are not offered here.
  const items: PolicyItem[] = currentPolicies(policies).map((p) => ({
    id: p.id,
    name: p.name,
    source: p.source,
    sampleKey: p.sample?.key ?? null,
    role: p.sample?.role ?? null,
    description: p.sample
      ? (catalog.get(p.sample.key)?.description ?? "")
      : `${p.text.length.toLocaleString("en-US")} characters, added ${new Date(p.createdAt).toLocaleDateString("en-US")}`,
    flagged: p.flagged,
    findings: p.scan?.findings ?? [],
    text: p.flagged ? p.text : null,
  }));
  return <PolicyHome policies={items} seedError={error} />;
}
