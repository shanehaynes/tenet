import "server-only";
import { loadRunOr404 } from "../../../_lib/server";
import { CollisionsClient } from "@/components/CollisionsClient";
import { settings } from "@/core/config";
import { readCapabilitiesFile } from "@/core/model/capabilities";
import { capabilitiesKey } from "@/core/schemas/capabilities";

export const dynamic = "force-dynamic";

export default async function CollisionsPage({ params }: PageProps<"/runs/[runId]/collisions">) {
  const { runId } = await params;
  const data = await loadRunOr404(runId);
  const s = settings();
  const caps = (await readCapabilitiesFile())[capabilitiesKey(data.run.config.provider, s.targetModel)];
  const suggested = caps?.suggestedConcurrency ?? null;
  return (
    <CollisionsClient
      initial={data}
      defaults={{
        spendCapUsd: s.spendCapUsd,
        concurrency: suggested ? Math.min(6, suggested) : s.concurrency,
        agentUrl: s.agentUrl,
        agentName: s.agentName,
      }}
    />
  );
}
