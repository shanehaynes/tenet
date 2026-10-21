import Link from "next/link";
import type { RunStatus } from "@/core/schemas/records";
import { cn } from "@/lib/utils";

// The five steps of a run (architecture §9): Classify → Review → Collisions → Run → Report.

const STEPS = [
  { key: "classify", label: "Classify" },
  { key: "review", label: "Review" },
  { key: "collisions", label: "Collisions" },
  { key: "run", label: "Run" },
  { key: "report", label: "Report" },
] as const;

export function stepFor(status: RunStatus): number {
  switch (status) {
    case "created":
    case "scanning":
    case "quarantined":
    case "decomposing":
    case "classifying":
      return 0;
    case "awaiting_review":
      return 1;
    case "mapping_collisions":
    case "awaiting_collision_review":
      return 2;
    case "generating":
    case "executing":
    case "reporting":
      return 3;
    default:
      return 4;
  }
}

export function RunStepper({ runId, status }: { runId: string; status: RunStatus }) {
  const current = stepFor(status);
  const href = (i: number) => (i <= 1 ? `/runs/${runId}/review` : i === 2 ? `/runs/${runId}/collisions` : `/runs/${runId}/report`);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Run steps">
      {STEPS.map((s, i) => {
        const done = i < current;
        const here = i === current;
        const body = (
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1",
              here && "border-indigo-800 bg-indigo-50 font-medium text-indigo-900",
              done && "border-zinc-300 text-zinc-700",
              !here && !done && "border-zinc-200 text-zinc-400",
            )}
          >
            <span className={cn("flex size-5 items-center justify-center rounded-full text-xs", here ? "bg-indigo-800 text-white" : done ? "bg-zinc-200" : "bg-zinc-100")}>
              {i + 1}
            </span>
            {s.label}
          </span>
        );
        return (
          <li key={s.key} className="flex items-center gap-2">
            {done && i !== 3 ? <Link href={href(i)}>{body}</Link> : body}
            {i < STEPS.length - 1 && <span className="text-zinc-300">→</span>}
          </li>
        );
      })}
    </ol>
  );
}
