import type { RuleCard } from "../schemas/summary";
import { COLORS, scenarioColor } from "./palette";

// Ladder strip (architecture §10): one chip per rung in tactic order, colored by verdict. The first violated
// rung gets a thick border; unverified verdicts a dotted outline; rungs not run are hatched.

const VERDICT_TEXT: Record<string, string> = { held: "held", partial: "bent", violated: "folded", unclear: "unclear" };

export function LadderStrip({ ladder }: { ladder: NonNullable<RuleCard["ladder"]> }) {
  const w = 118;
  const gap = 6;
  const width = ladder.rungs.length * (w + gap) - gap;
  return (
    <figure className="tr-figure">
      <svg viewBox={`0 0 ${width} 58`} width="100%" role="img" aria-label={`Pressure ladder: ${ladder.caption}`}>
        <defs>
          <pattern id="tr-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#f4f4f5" />
            <line x1="0" y1="0" x2="0" y2="6" stroke={COLORS.notRun} strokeWidth="2" />
          </pattern>
        </defs>
        {ladder.rungs.map((r, i) => {
          const x = i * (w + gap);
          const color = scenarioColor(r.verdict, r.verified);
          const fold = ladder.foldedAt === r.index;
          return (
            <g key={r.scenarioId} data-scenario-id={r.scenarioId} className="tr-clickable">
              <title>{`Rung ${r.index} (${r.tactic.replace(/_/g, " ")}): ${r.verdict ?? "not judged"}${r.verdict && !r.verified ? " (evidence unverified)" : ""}`}</title>
              <rect
                x={x + 1}
                y={1}
                width={w - 2}
                height={56}
                rx={6}
                fill={r.verdict === null ? "url(#tr-hatch)" : color}
                fillOpacity={r.verdict === null ? 1 : 0.14}
                stroke={color}
                strokeWidth={fold ? 3 : 1.2}
                strokeDasharray={r.verdict && !r.verified ? "3 3" : undefined}
              />
              <text x={x + w / 2} y={22} textAnchor="middle" fontSize="11" fill="#3f3f46">
                {r.index}. {r.tactic.replace(/_/g, " ")}
              </text>
              <text x={x + w / 2} y={42} textAnchor="middle" fontSize="13" fontWeight="600" fill={color}>
                {r.verdict ? (VERDICT_TEXT[r.verdict] ?? r.verdict) : "not run"}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="tr-caption">{ladder.caption.replace(/^./, (c) => c.toUpperCase())}.</figcaption>
    </figure>
  );
}
