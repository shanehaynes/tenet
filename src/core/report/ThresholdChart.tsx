import type { RuleCard } from "../schemas/summary";
import { ACCENT, COLORS, MUTED, RULE_LINE } from "./palette";

// Threshold chart (architecture §10; the professor's "money shot"): the sweep variable on x (log scale when
// the range is wide), the agent's behavior on y, the policy's stated threshold as a dashed line and the
// observed switch-over as a shaded band. Pure SVG.

type Sweep = NonNullable<RuleCard["sweep"]>;

const W = 640;
const H = 276;
const M = { left: 132, right: 28, top: 30, bottom: 80 };
const ROWS = [
  { key: "escalated_or_refused", label: "escalated / refused" },
  { key: "partial", label: "partial safeguards" },
  { key: "complied", label: "complied" },
] as const;

function fmtValue(v: number, unit: string | null): string {
  const n = Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k` : v.toLocaleString("en-US");
  return unit && /usd|dollar|\$/i.test(unit) ? `$${n}` : n;
}

export function ThresholdChart({ sweep }: { sweep: Sweep }) {
  const pts = sweep.points.filter((p) => Number.isFinite(p.value));
  if (pts.length === 0) return null;
  const values = pts.map((p) => p.value);
  const lo = Math.min(...values, sweep.impliedThreshold ?? Infinity);
  const hi = Math.max(...values, sweep.impliedThreshold ?? -Infinity);
  const log = lo > 0 && hi / lo > 100;
  const ordinal = sweep.variable.kind !== "amount" && pts.every((p) => Number.isInteger(p.value) && p.value <= 12);
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const xOf = (v: number) => {
    if (ordinal) {
      const i = pts.findIndex((p) => p.value === v);
      return M.left + (pts.length === 1 ? plotW / 2 : (Math.max(0, i) / (pts.length - 1)) * plotW);
    }
    const t = log ? (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo) || 1) : (v - lo) / (hi - lo || 1);
    return M.left + t * plotW;
  };
  const rowY = (key: string | null) => {
    const i = ROWS.findIndex((r) => r.key === key);
    return M.top + (i < 0 ? 1 : i) * (plotH / (ROWS.length - 1));
  };
  const implied = sweep.impliedThreshold;
  const colorOf = (p: (typeof pts)[number]) => {
    if (p.behavior === null) return COLORS.pending;
    if (!p.verified || p.behavior === "unclear") return COLORS.unclear;
    if (implied === null) return p.behavior === "complied" ? MUTED : ACCENT;
    const above = p.value > implied;
    if (p.behavior === "escalated_or_refused") return above ? COLORS.good : COLORS.bent;
    if (p.behavior === "complied") return above ? COLORS.bad : COLORS.good;
    return COLORS.bent;
  };
  const judged = pts.filter((p) => p.behavior !== null);
  const step = judged.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.value)} ${rowY(p.behavior)}`).join(" ");
  const { lastComplied, firstRequired } = sweep.observedThreshold;
  const bandFrom = lastComplied !== null ? xOf(lastComplied) : null;
  const bandTo = firstRequired !== null ? xOf(firstRequired) : null;
  return (
    <figure className="tr-figure tr-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={sweep.caption}>
        {ROWS.map((r) => (
          <g key={r.key}>
            <line x1={M.left} x2={W - M.right} y1={rowY(r.key)} y2={rowY(r.key)} stroke={RULE_LINE} />
            <text x={M.left - 10} y={rowY(r.key) + 4} textAnchor="end" fontSize="11" fill={MUTED}>
              {r.label}
            </text>
          </g>
        ))}
        {bandFrom !== null && bandTo !== null && bandTo > bandFrom && (
          <g>
            <rect x={bandFrom} y={M.top - 10} width={bandTo - bandFrom} height={plotH + 20} fill={ACCENT} opacity={0.08} />
            <text x={(bandFrom + bandTo) / 2} y={M.top - 14} textAnchor="middle" fontSize="11" fill={ACCENT}>
              observed switch
            </text>
          </g>
        )}
        {implied !== null && (
          <g>
            <line x1={xOf(implied)} x2={xOf(implied)} y1={M.top - 12} y2={M.top + plotH + 8} stroke="#18181b" strokeDasharray="5 4" strokeWidth={1.5} />
            <text x={xOf(implied)} y={M.top + plotH + 24} textAnchor="middle" fontSize="11" fill="#18181b" fontWeight="600">
              policy: {fmtValue(implied, sweep.variable.unit)}
            </text>
          </g>
        )}
        {step && <path d={step} fill="none" stroke="#a1a1aa" strokeWidth={1.5} />}
        {pts.map((p) => (
          <g key={p.scenarioId} data-scenario-id={p.scenarioId} className="tr-clickable">
            <title>{`${p.label}: ${p.behavior ?? "not judged"}${p.behavior && !p.verified ? " (evidence unverified)" : ""}`}</title>
            <circle cx={xOf(p.value)} cy={rowY(p.behavior)} r={7} fill={colorOf(p)} stroke="#ffffff" strokeWidth={1.5} />
          </g>
        ))}
        {pts.map((p, i) =>
          ordinal || i % (pts.length > 8 ? 2 : 1) === 0 || i === pts.length - 1 ? (
            <text key={`l-${p.scenarioId}`} x={xOf(p.value)} y={H - 30} textAnchor="middle" fontSize="10" fill={MUTED}>
              {ordinal ? p.index : fmtValue(p.value, sweep.variable.unit)}
            </text>
          ) : null,
        )}
        <text x={M.left + plotW / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={MUTED}>
          {sweep.variable.name}
          {log ? " (log scale)" : ""}
        </text>
      </svg>
      <figcaption className="tr-caption">
        {sweep.caption}
        {ordinal ? ` Points: ${pts.map((p) => `${p.index} = ${p.label}`).join("; ")}.` : ""}
      </figcaption>
    </figure>
  );
}
