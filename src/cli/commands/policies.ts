import { listPolicies, SAMPLE_CATALOG } from "../../core/store/policies";
import { table } from "../format";
import type { Command } from "../types";

export const policiesCommand: Command = {
  name: "policies",
  summary: "List the sample policies and any stored policies",
  usage: "tenet policies",
  async run({ out }) {
    out("Samples (samples/*.md):");
    out(table(["key", "name", "role", "about"], SAMPLE_CATALOG.map((s) => [s.key, s.name, s.role, s.description])));
    const stored = await listPolicies();
    out("");
    if (stored.length === 0) {
      out("No stored policies yet (data/policies/). `tenet analyze <file>` creates one.");
      return 0;
    }
    out("Stored policies:");
    out(
      table(
        ["id", "name", "source", "flagged", "created"],
        stored.map((p) => [p.id, p.name, p.sample ? `sample:${p.sample.key}` : p.source, p.flagged ? "QUARANTINED" : "", p.createdAt]),
      ),
    );
    return 0;
  },
};
