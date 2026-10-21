import { RULE_TYPES, type Probabilities } from "../schemas/agents";
import type { RuleVerdict } from "../schemas/summary";
import { COLORS, INK, MUTED, RULE_LINE, verdictColor } from "./palette";

// The ambiguity map (architecture §10): each rule sits at the barycentric position of its type
// probabilities between four corner anchors. A rule whose top probability clears the threshold lies inside
// that corner's square of side (1 − threshold) × size, so the corners are shaded as confident zones and the
// rest of the square is where the policy's authors left the type undecided. Pure SVG: the same markup
// renders in the app, the standalone export and print.

export type MapNode = {
  ruleId: string;
  index: number;
  statement: string;
  probabilities: Probabilities | null;
  parked: boolean;
  verdict: RuleVerdict | null;
};
export type MapArc = { id: string; ruleA: string; ruleB: string; dismissed: boolean };

const W = 640;
const H = 480;
const PAD = { left: 96, right: 96, top: 44, bottom: 44 };
const SIDE = Math.min(W - PAD.left - PAD.right, H - PAD.top - PAD.bottom);
const X0 = (W - SIDE) / 2;
const Y0 = PAD.top;
const R = 11;

const ANCHORS: Record<(typeof RULE_TYPES)[number], [number, number]> = {
  constraint: [0, 0],
  tradeoff: [1, 0],
  disposition: [0, 1],
  ordering: [1, 1],
};

/** Barycentric position in the unit square (0,0 = constraint corner). Unclassified rules sit in the middle. */
export function mapPosition(p: Probabilities | null): [number, number] {
  if (!p) return [0.5, 0.5];
  const total = RULE_TYPES.reduce((s, t) => s + Math.max(0, p[t]), 0) || 1;
  let x = 0;
  let y = 0;
  for (const t of RULE_TYPES) {
    const w = Math.max(0, p[t]) / total;
    x += w * ANCHORS[t][0];
    y += w * ANCHORS[t][1];
  }
  return [x, y];
}

export function isAmbiguous(p: Probabilities | null, threshold: number): boolean {
  if (!p) return true;
  return Math.max(...RULE_TYPES.map((t) => p[t])) < threshold;
}

/** Nudges overlapping nodes apart along a deterministic spiral, staying inside the square. */
function layout(nodes: MapNode[]): Map<string, [number, number]> {
  const placed = new Map<string, [number, number]>();
  const sorted = [...nodes].sort((a, b) => a.index - b.index);
  for (const n of sorted) {
    const [ux, uy] = mapPosition(n.probabilities);
    const inset = (v: number) => Math.min(SIDE - R - 3, Math.max(R + 3, v * SIDE));
    let x = X0 + inset(ux);
    let y = Y0 + inset(uy);
    for (let k = 0; k < 60; k++) {
      const clash = [...placed.values()].some(([px, py]) => Math.hypot(px - x, py - y) < 2 * R + 2);
      if (!clash) break;
      const angle = k * 2.399963; // golden angle
      const dist = (2 * R + 2) * Math.sqrt(k + 1) * 0.75;
      x = X0 + ux * SIDE + Math.cos(angle) * dist;
      y = Y0 + uy * SIDE + Math.sin(angle) * dist;
      x = Math.min(X0 + SIDE - R, Math.max(X0 + R, x));
      y = Math.min(Y0 + SIDE - R, Math.max(Y0 + R, y));
    }
    placed.set(n.ruleId, [x, y]);
  }
  return placed;
}

export function AmbiguityMap(props: { nodes: MapNode[]; arcs: MapArc[]; threshold: number; title?: string; linkPrefix?: string }) {
  const { nodes, arcs, threshold } = props;
  const zone = (1 - threshold) * SIDE;
  const pos = layout(nodes);
  const classified = nodes.filter((n) => n.probabilities !== null);
  const ambiguous = classified.filter((n) => isAmbiguous(n.probabilities, threshold));
  const corners: { label: string; x: number; y: number; anchor: "start" | "end"; tx: number; ty: number }[] = [
    { label: "Constraint", x: X0, y: Y0, anchor: "end", tx: X0 - 8, ty: Y0 + 12 },
    { label: "Tradeoff", x: X0 + SIDE - zone, y: Y0, anchor: "start", tx: X0 + SIDE + 8, ty: Y0 + 12 },
    { label: "Disposition", x: X0, y: Y0 + SIDE - zone, anchor: "end", tx: X0 - 8, ty: Y0 + SIDE - 4 },
    { label: "Ordering", x: X0 + SIDE - zone, y: Y0 + SIDE - zone, anchor: "start", tx: X0 + SIDE + 8, ty: Y0 + SIDE - 4 },
  ];
  return (
    <figure className="tr-figure tr-map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={props.title ?? "Ambiguity map of the policy's rules"} width="100%">
        <rect x={X0} y={Y0} width={SIDE} height={SIDE} fill="#fafafa" stroke={RULE_LINE} />
        {corners.map((c) => (
          <g key={c.label}>
            <rect x={c.x} y={c.y} width={zone} height={zone} fill="#eef2ff" stroke="#c7d2fe" />
            <text x={c.tx} y={c.ty} textAnchor={c.anchor} fontSize="13" fontWeight="600" fill={INK}>
              {c.label}
            </text>
          </g>
        ))}
        <text x={X0 + SIDE / 2} y={Y0 + SIDE / 2 + 4} textAnchor="middle" fontSize="12" fill={MUTED} opacity={0.8}>
          ambiguous zone
        </text>
        <text x={X0 + SIDE / 2} y={Y0 - 16} textAnchor="middle" fontSize="11" fill={MUTED}>
          shaded corners: top type probability ≥ {threshold}
        </text>
        {arcs.map((a) => {
          const p1 = pos.get(a.ruleA);
          const p2 = pos.get(a.ruleB);
          if (!p1 || !p2) return null;
          const dx = p2[0] - p1[0];
          const dy = p2[1] - p1[1];
          const len = Math.hypot(dx, dy) || 1;
          const bend = Math.max(30, len / 4);
          const mx = (p1[0] + p2[0]) / 2 + (-dy / len) * bend;
          const my = (p1[1] + p2[1]) / 2 + (dx / len) * bend;
          return (
            <path
              key={a.id}
              d={`M ${p1[0]} ${p1[1]} Q ${mx} ${my} ${p2[0]} ${p2[1]}`}
              fill="none"
              stroke={COLORS.bad}
              strokeWidth={2}
              strokeDasharray={a.dismissed ? "4 4" : undefined}
              opacity={a.dismissed ? 0.5 : 0.85}
            >
              <title>{`Collision ${a.id}${a.dismissed ? " (dismissed)" : ""}`}</title>
            </path>
          );
        })}
        {[...nodes]
          .sort((a, b) => a.index - b.index)
          .map((n) => {
            const [x, y] = pos.get(n.ruleId)!;
            const color = n.verdict ? verdictColor(n.verdict) : "#a1a1aa";
            const body = (
              <g data-rule-id={n.ruleId} className="tr-map-node">
                <title>{`Rule ${n.index}: ${n.statement}${n.probabilities ? `\n${RULE_TYPES.map((t) => `${t} ${n.probabilities![t].toFixed(2)}`).join(" · ")}` : "\nnot classified"}`}</title>
                <circle cx={x} cy={y} r={R} fill={n.parked ? "#ffffff" : color} stroke={color} strokeWidth={n.parked ? 2 : 1} />
                <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={n.parked ? color : "#ffffff"}>
                  {n.index}
                </text>
              </g>
            );
            return props.linkPrefix !== undefined ? (
              <a key={n.ruleId} href={`${props.linkPrefix}#rule-${n.ruleId}`}>
                {body}
              </a>
            ) : (
              <g key={n.ruleId}>{body}</g>
            );
          })}
      </svg>
      <figcaption className="tr-caption">
        {classified.length === 0
          ? "Rules appear here as they are classified."
          : `${ambiguous.length} of ${classified.length} classified rules sit in the ambiguous zone: the policy's authors never decided what kind of rule ${ambiguous.length === 1 ? "it is" : "they are"}.`}{" "}
        Hollow circles are parked; red arcs are collisions{arcs.some((a) => a.dismissed) ? " (dotted: dismissed)" : ""}.
      </figcaption>
    </figure>
  );
}
