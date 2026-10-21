import { writeFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { readAllTranscripts, readOrComputeSummary } from "../../core/pipeline/summary";
import { usageCsv } from "../../core/report/csv";
import { exportHtml } from "../../core/report/exportHtml";
import { readRunUsage } from "../../core/store/usage";
import type { Command } from "../types";

export const exportCommand: Command = {
  name: "export",
  summary: "Write the standalone report HTML (and optionally the usage CSV) for a run",
  usage: "tenet export <runId> [--out report.html] [--csv usage.csv]",
  options: { out: { type: "string" }, csv: { type: "string" } },
  async run({ values, positionals, out, err }) {
    const runId = positionals[0];
    if (!runId) {
      err("Give a run id.");
      return 1;
    }
    const file = (values.out as string | undefined) ?? `tenet-report-${runId}.html`;
    const [summary, transcripts] = await Promise.all([readOrComputeSummary(runId), readAllTranscripts(runId)]);
    await writeFile(file, exportHtml(renderToStaticMarkup, summary, transcripts), "utf8");
    out(`Report written to ${file}`);
    if (values.csv) {
      await writeFile(values.csv as string, usageCsv(await readRunUsage(runId)), "utf8");
      out(`Usage written to ${values.csv}`);
    }
    return 0;
  },
};
