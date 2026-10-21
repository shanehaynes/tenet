import type { RuleCard } from "../schemas/summary";
import { COLORS, MUTED, RULE_LINE, scenarioColor } from "./palette";

// Paraphrase dots (architecture §10): one dot per paraphrase at its trait score (0, 1 or 2); outliers from
// the modal score are ringed.

type Para = NonNullable<RuleCard["paraphrase"]>;

export function ParaphraseDots({ paraphrase }: { paraphrase: Para }) {
  const W = 640;
  const H = 150;
  const M = { left: 70, right: 44, top: 16, bottom: 36 };
  const n = paraphrase.items.length;
  const xOf = (i: number) => M.left + (n <= 1 ? 0 : (i / (n - 1)) * (W - M.left - M.right));
  const yOf = (score: number | null) => (score === null ? M.top + (H - M.top - M.bottom) / 2 : M.top + ((2 - score) / 2) * (H - M.top - M.bottom));
  const outliers = new Set(paraphrase.outlierScenarioIds);
  return (
    <figure className="tr-figure tr-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Trait score per paraphrase">
        {[2, 1, 0].map((s) => (
          <g key={s}>
            <line x1={M.left} x2={W - M.right} y1={yOf(s)} y2={yOf(s)} stroke={RULE_LINE} />
            <text x={M.left - 10} y={yOf(s) + 4} textAnchor="end" fontSize="11" fill={MUTED}>
              {s === 2 ? "clear" : s === 1 ? "weak" : "absent"}
            </text>
          </g>
        ))}
        {paraphrase.items.map((it, i) => (
          <g key={it.scenarioId} data-scenario-id={it.scenarioId} className="tr-clickable">
            <title>{`${it.dimension}: ${it.traitScore ?? "not judged"}`}</title>
            {outliers.has(it.scenarioId) && <circle cx={xOf(i)} cy={yOf(it.traitScore)} r={11} fill="none" stroke={COLORS.bad} strokeWidth={1.5} />}
            <circle cx={xOf(i)} cy={yOf(it.traitScore)} r={6.5} fill={scenarioColor(it.traitScore === null ? null : String(it.traitScore), true)} />
            <text x={xOf(i)} y={H - 14} textAnchor="middle" fontSize="10" fill={MUTED}>
              {it.dimension}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="tr-caption">
        Consistency {paraphrase.consistency === null ? "—" : `${Math.round(paraphrase.consistency * 100)} %`} (share of paraphrases at the most common score
        {paraphrase.modalScore === null ? "" : `, ${paraphrase.modalScore}`}); ringed dots are outliers.
      </figcaption>
    </figure>
  );
}
