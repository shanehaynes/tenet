import "server-only";
import "../_lib/server";
import Link from "next/link";
import { formatUsd } from "@/core/report/palette";
import { listRuns } from "@/core/store/runs";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  complete: "text-green-700",
  halted: "text-red-700",
  failed: "text-red-700",
  quarantined: "text-red-700",
  interrupted: "text-amber-700",
};

export default async function RunsPage() {
  const runs = await listRuns();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
      {runs.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No runs yet. <Link className="underline" href="/">Analyze a policy</Link> to start one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Policy</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Calls</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="px-3 py-2">Provider</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="h-10 border-b border-zinc-100 last:border-0">
                  <td className="px-3">
                    <Link className="font-medium underline-offset-2 hover:underline" href={`/runs/${r.id}`}>
                      {r.policyName}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-zinc-400">{r.id}</span>
                  </td>
                  <td className="px-3 text-zinc-600">{new Date(r.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className={cn("px-3", TONE[r.status] ?? "text-zinc-600")}>{r.status.replace(/_/g, " ")}</td>
                  <td className="px-3 text-right tabular-nums">{r.totals.calls}</td>
                  <td className="px-3 text-right tabular-nums">{formatUsd(r.totals.usd)}</td>
                  <td className="px-3 text-zinc-600">{r.config.provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
