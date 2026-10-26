import { RULE_TYPES } from "../schemas/agents";
import { actionOutcome, type Transcript } from "../schemas/records";
import type { RuleCard, Summary } from "../schemas/summary";
import { AmbiguityMap, type MapNode } from "./AmbiguityMap";
import { LadderStrip } from "./LadderStrip";
import { COLORS, formatCompact, formatInt, formatMs, formatUsd, scenarioColor, TEST_LABEL, VERDICT_LABEL, verdictColor } from "./palette";
import { ParaphraseDots } from "./ParaphraseDots";
import { ThresholdChart } from "./ThresholdChart";

// The report (architecture §9–10; PRD Req. 10). One React tree with no hooks, no handlers and no Tailwind:
// the app renders it with a transcript drawer layered on top, and the standalone export renders the same
// tree to static HTML with transcripts inlined. Both read the same Summary, so they cannot disagree.

export type ReportProps = {
  summary: Summary;
  /** Export only: transcripts to inline under each piece of evidence. */
  transcripts?: Record<string, Transcript>;
  /** Live view: the run is still executing. */
  liveNote?: string;
};

/** The agent's tool calls under a transcript (HTTP targets): what it drafted, filed or was refused. */
function ExportActions({ transcript }: { transcript: Transcript }) {
  if (!transcript.actions?.length) return null;
  return (
    <ol className="tr-actions">
      {transcript.actions.map((a, i) => {
        const outcome = actionOutcome(a).kind;
        const refused = outcome === "refused";
        const args = a.arguments && typeof a.arguments === "object" && !Array.isArray(a.arguments) ? Object.entries(a.arguments as Record<string, unknown>) : [];
        const result = JSON.stringify(a.result) ?? "";
        return (
          <li key={i} className={refused ? "tr-action tr-refused" : "tr-action"}>
            <code>{a.name}</code>
            {refused && <span className="tr-flag"> refused by the tool</span>}
            {outcome === "malformed" && <span className="tr-flag"> rejected: malformed arguments</span>}
            {args.map(([k, v]) => (
              <span key={k} className="tr-arg">
                <code>{k}</code> {typeof v === "string" ? v : JSON.stringify(v)}
              </span>
            ))}
            <span className="tr-result">→ {result.length > 300 ? `${result.slice(0, 300)}…` : result}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Evidence({
  scenarioId,
  quote,
  verified,
  transcripts,
  hideQuote = false,
}: {
  scenarioId: string;
  quote: string;
  verified: boolean;
  transcripts?: Record<string, Transcript>;
  /** The quote is already on the card (a conflict table's Evidence column): show only the transcript link. */
  hideQuote?: boolean;
}) {
  const t = transcripts?.[scenarioId];
  return (
    <div className="tr-evidence">
      {!hideQuote && (
        <blockquote className={verified ? "tr-quote" : "tr-quote tr-unverified"}>
          “{quote}”{!verified && <span className="tr-flag"> unverified</span>}
        </blockquote>
      )}
      {t ? (
        <details className="tr-transcript">
          <summary>Transcript {scenarioId}</summary>
          {t.messages.map((m, i) => (
            <p key={i} className={`tr-msg tr-msg-${m.role}`}>
              <strong>{m.role === "user" ? "User" : "Agent"}:</strong> {m.content}
            </p>
          ))}
          <ExportActions transcript={t} />
        </details>
      ) : (
        <button type="button" className="tr-link" data-scenario-id={scenarioId}>
          Open transcript {scenarioId}
        </button>
      )}
    </div>
  );
}

function Probabilities({ p }: { p: NonNullable<RuleCard["probabilities"]> }) {
  return (
    <span className="tr-probs">
      {RULE_TYPES.map((t) => (
        <span key={t}>
          {t} {p[t].toFixed(2)}
        </span>
      ))}
    </span>
  );
}

/** The rule's pill: a rule that held but carries a note (an escalation far below its threshold) is not plain green. */
function verdictPill(card: RuleCard): { label: string; color: string } {
  if (card.verdict === "pass" && card.warnings.length > 0) return { label: "Holds, with a note", color: COLORS.bent };
  return { label: VERDICT_LABEL[card.verdict], color: verdictColor(card.verdict) };
}

const SCORE_TEXT: Record<number, string> = { 2: "showed the trait clearly", 1: "showed the trait weakly", 0: "lacked the trait" };

/** One line that says what a ladder or paraphrase test found, for the folded chart on a rule that held. */
function resultLine(card: RuleCard): string {
  if (card.ladder) return `${TEST_LABEL.ladder}: ${card.ladder.caption}`;
  if (card.paraphrase) {
    const p = card.paraphrase;
    const at = p.modalScore === null ? 0 : p.items.filter((i) => i.traitScore === p.modalScore).length;
    return p.modalScore === null ? `${TEST_LABEL.paraphrase}: not judged` : `${TEST_LABEL.paraphrase}: ${at} of ${p.items.length} paraphrases ${SCORE_TEXT[p.modalScore] ?? `scored ${p.modalScore}`}`;
  }
  return "";
}

function RuleCardView({ card, transcripts, summary, compact = false }: { card: RuleCard; transcripts?: Record<string, Transcript>; summary: Summary; compact?: boolean }) {
  const pill = verdictPill(card);
  const tone = card.verdict === "fail" ? " tr-card-bad" : card.verdict === "partial" ? " tr-card-bent" : "";
  const charts = (
    <>
      {card.ladder && <LadderStrip ladder={card.ladder} />}
      {card.paraphrase && <ParaphraseDots paraphrase={card.paraphrase} />}
    </>
  );
  return (
    <section className={`tr-card${tone}`} id={`rule-${card.ruleId}`}>
      <header className="tr-card-head">
        <span className="tr-index">Rule {card.index}</span>
        {card.type && <span className="tr-type">{card.type}</span>}
        {card.testKind && <span className="tr-test">{TEST_LABEL[card.testKind] ?? card.testKind}</span>}
        <span className="tr-verdict" style={{ color: pill.color, borderColor: pill.color }}>
          {pill.label}
        </span>
      </header>
      <p className="tr-statement">{card.statement}</p>
      {card.quote && card.quote !== card.statement && (
        <p className="tr-source">
          <span className="tr-source-label">Source wording</span>“{card.quote}”
        </p>
      )}
      {compact && (card.ladder || card.paraphrase) ? (
        <details className="tr-fold-chart">
          <summary>
            {resultLine(card)}
            <span className="tr-fold-hint">Show the test</span>
          </summary>
          {charts}
        </details>
      ) : (
        charts
      )}
      {card.sweep && card.type === "constraint" && <p className="tr-small">A constraint with a numeric trigger: tested by a stakes sweep across the trigger.</p>}
      {card.sweep && <ThresholdChart sweep={card.sweep} />}
      {card.conflicts && (
        <table className="tr-table">
          <thead>
            <tr>
              <th>Conflict (higher-ranked first)</th>
              <th>Value that won</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {card.conflicts.map((c) => (
              <tr key={c.scenarioId} data-scenario-id={c.scenarioId} className="tr-clickable">
                <td>{c.label}</td>
                <td style={{ color: scenarioColor(c.honored, c.verified) }}>
                  {c.honored === "a" ? "higher-ranked" : c.honored === "b" ? "lower-ranked" : (c.honored ?? "not run")}
                  {c.honored && !c.verified ? " (unverified)" : ""}
                </td>
                <td className="tr-small">{c.evidence ? `“${c.evidence}”` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {card.verdict === "parked" && (
        <p className="tr-note">
          Parked{card.confidence !== null && card.confidence < summary.map.threshold ? " as ambiguous" : ""}: not tested.
          {summary.defects.ambiguities.some((a) => a.ruleId === card.ruleId) && (
            <>
              {" "}
              <a href="#tr-defects">Why: see Policy defects</a>.
            </>
          )}
          {card.probabilities && (
            <>
              {" "}
              Classifier: <Probabilities p={card.probabilities} />
            </>
          )}
        </p>
      )}
      {card.verdict === "designed_not_run" && <p className="tr-note">Designed, not run in this version: the {TEST_LABEL[card.testKind ?? ""] ?? "test"} generator was switched off.</p>}
      {card.headlineEvidence && (
        <Evidence {...card.headlineEvidence} transcripts={transcripts} hideQuote={card.conflicts?.some((c) => c.scenarioId === card.headlineEvidence!.scenarioId && c.evidence)} />
      )}
      {card.warnings.map((w) => (
        <p key={w} className="tr-warning">
          {w}
        </p>
      ))}
    </section>
  );
}

/** Export only: every transcript, grouped by rule, collapsed (the standalone file has no drawer). */
function TranscriptAppendix({ summary, transcripts }: { summary: Summary; transcripts: Record<string, Transcript> }) {
  const ids = Object.keys(transcripts).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const owner = id.split("-")[0];
    groups.set(owner, [...(groups.get(owner) ?? []), id]);
  }
  const byId = new Map(summary.rules.map((r) => [r.ruleId, r]));
  return (
    <>
      <h2>Appendix: transcripts</h2>
      <p className="tr-lede-small">Every scenario the agent saw and what it replied, grouped by rule. Scenario ids read as their test: r2-L5 is rule 2&apos;s fifth ladder rung, r10-S3 the third sweep point, c1-C1 the first scenario for collision 1.</p>
      {[...groups.entries()].map(([owner, list]) => (
        <section key={owner} className="tr-appendix">
          <h3>{byId.get(owner) ? `Rule ${byId.get(owner)!.index}: ${byId.get(owner)!.statement}` : `Collision ${owner}`}</h3>
          {list.map((id) => (
            <details key={id} id={`t-${id}`} className="tr-transcript">
              <summary>{id}</summary>
              {transcripts[id].messages.map((m, i) => (
                <p key={i} className={`tr-msg tr-msg-${m.role}`}>
                  <strong>{m.role === "user" ? "User" : "Agent"}:</strong> {m.content}
                </p>
              ))}
              <ExportActions transcript={transcripts[id]} />
            </details>
          ))}
        </section>
      ))}
    </>
  );
}

export function mapNodes(summary: Summary): MapNode[] {
  return summary.rules.map((r) => ({
    ruleId: r.ruleId,
    index: r.index,
    statement: r.statement,
    probabilities: r.probabilities,
    parked: r.parked,
    verdict: summary.partial && r.verdict === "pending" ? null : ["not_run", "parked", "designed_not_run"].includes(r.verdict) ? null : r.verdict,
  }));
}

/** "Rule 10", "Rules 10 and 14", "Rules 1, 4 and 9". */
function ruleList(indexes: number[]): string {
  if (indexes.length === 1) return `Rule ${indexes[0]}`;
  return `Rules ${indexes.slice(0, -1).join(", ")} and ${indexes.at(-1)}`;
}

type Finding = { lead: string; detail: string; statement?: string; href: string; color: string };

/** The report's headline: departures first, then notes, tradeoffs and the policy's own defects. Each links to its evidence. */
export function findings(summary: Summary): Finding[] {
  const out: Finding[] = [];
  const byId = new Map(summary.rules.map((r) => [r.ruleId, r]));
  for (const r of summary.rules) {
    if (r.verdict !== "fail" && r.verdict !== "partial") continue;
    const why = r.ladder?.caption ?? r.sweep?.caption ?? (r.conflicts ? "the lower-ranked value won a forced conflict" : "the rule was not followed");
    out.push({ lead: `Rule ${r.index} ${r.verdict === "fail" ? "fails" : "bends"}`, detail: why, statement: r.statement, href: `#rule-${r.ruleId}`, color: verdictColor(r.verdict) });
  }
  for (const r of summary.rules) {
    if (r.verdict === "fail" || r.verdict === "partial" || r.warnings.length === 0) continue;
    out.push({ lead: `Rule ${r.index} holds, with a note`, detail: r.warnings[0], statement: r.statement, href: `#rule-${r.ruleId}`, color: COLORS.bent });
  }
  for (const r of summary.rules) {
    if (r.verdict !== "observed" || !r.sweep) continue;
    out.push({ lead: `Rule ${r.index}, a tradeoff`, detail: r.sweep.caption, statement: r.statement, href: `#rule-${r.ruleId}`, color: COLORS.accent });
  }
  const amb = summary.defects.ambiguities.map((a) => byId.get(a.ruleId)?.index).filter((i): i is number => i !== undefined);
  if (amb.length) {
    out.push({
      lead: `${ruleList(amb)} ${amb.length === 1 ? "is" : "are"} ambiguous`,
      detail: `the wording never settles what kind of rule ${amb.length === 1 ? "it is" : "they are"}, so the policy needs a decision before ${amb.length === 1 ? "it" : "they"} can be tested`,
      href: "#tr-defects",
      color: COLORS.accent,
    });
  }
  for (const col of summary.defects.collisions) {
    const a = byId.get(col.ruleA);
    const b = byId.get(col.ruleB);
    if (!a || !b) continue;
    const did = !col.outcome ? "not tested" : col.outcome.honored === "a" ? `the agent followed rule ${a.index}` : col.outcome.honored === "b" ? `the agent followed rule ${b.index}` : col.outcome.honored === "both" ? "the agent satisfied both" : "the agent satisfied neither";
    out.push({ lead: `Rules ${a.index} and ${b.index} collide`, detail: `nothing in the policy says which wins; ${did}`, href: "#tr-defects", color: COLORS.bad });
  }
  return out;
}

/** The finding counts, large; the run's own metrics go on a quieter line below (RunLine). */
export function SummaryStrip({ summary }: { summary: Summary }) {
  const s = summary.strip;
  const tiles: { label: string; value: string; tone?: string }[] = [
    { label: "Rules tested", value: `${s.rulesTested} of ${s.rulesTotal}` },
    { label: "Failing", value: String(s.failures), tone: s.failures ? "bad" : undefined },
    { label: "Bending", value: String(s.partials), tone: s.partials ? "bent" : undefined },
    { label: "Ambiguous", value: String(s.ambiguities), tone: s.ambiguities ? "accent" : undefined },
    { label: "Collisions", value: String(s.collisions), tone: s.collisions ? "accent" : undefined },
    { label: "Unverified evidence", value: String(s.unverifiedCount) },
  ];
  return (
    <div className="tr-strip">
      {tiles.map((t) => (
        <div key={t.label} className={`tr-tile${t.tone ? ` tr-tone-${t.tone}` : ""}`}>
          <div className="tr-tile-value">{t.value}</div>
          <div className="tr-tile-label">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

function RunLine({ summary }: { summary: Summary }) {
  const s = summary.strip;
  return (
    <p className="tr-runline">
      {s.scenariosTotal - s.scenariosNotRun} scenarios run{s.scenariosNotRun ? ` (${s.scenariosNotRun} not run)` : ""} · {formatInt(s.calls)} model calls · tokens {formatCompact(s.inputTokens)} in, {formatCompact(s.cachedTokens)} cached,{" "}
      {formatCompact(s.outputTokens)} out · {formatUsd(s.usd)} · {formatMs(s.wallClockMs)} of testing
    </p>
  );
}

/** A small legend: a colored dot (or a hollow one, or an arc) and its meaning. */
function Key({ items }: { items: { label: string; color?: string; hollow?: boolean; arc?: boolean }[] }) {
  return (
    <p className="tr-key">
      {items.map((k) => (
        <span key={k.label}>
          <i className={k.hollow ? "tr-key-hollow" : k.arc ? "tr-key-arc" : undefined} style={k.hollow || k.arc ? { borderColor: k.color } : { background: k.color }} />
          {k.label}
        </span>
      ))}
    </p>
  );
}

type Group = { id: string; title: string; note?: string; cards: RuleCard[]; compact: boolean };

/** Rules grouped by what a reader should look at first; rule numbers keep the policy's order inside each group. */
function ruleGroups(summary: Summary): Group[] {
  const rules = summary.rules;
  const untested = new Set(["parked", "not_run", "designed_not_run"]);
  const departures = rules.filter((r) => r.verdict === "fail" || r.verdict === "partial");
  const look = rules.filter((r) => !departures.includes(r) && !untested.has(r.verdict) && (r.warnings.length > 0 || r.verdict === "observed" || r.verdict === "unclear"));
  const holds = rules.filter((r) => r.verdict === "pass" && !look.includes(r));
  const rest = rules.filter((r) => !departures.includes(r) && !look.includes(r) && !holds.includes(r));
  return [
    { id: "tr-rules-departures", title: "Fails or bends", cards: departures, compact: false },
    { id: "tr-rules-look", title: "Worth a look", note: "Tradeoffs have no pass line, so their chart shows where behavior shifts; the others held but carry a note.", cards: look, compact: false },
    { id: "tr-rules-holds", title: "Holds", note: "Each held on every scenario that ran. Open a test to see it.", cards: holds, compact: true },
    { id: "tr-rules-untested", title: "Not tested", note: "Parked as ambiguous, or not run.", cards: rest, compact: false },
  ].filter((g) => g.cards.length > 0);
}

export function ReportDocument({ summary, transcripts, liveNote }: ReportProps) {
  const byId = new Map(summary.rules.map((r) => [r.ruleId, r]));
  const c = summary.config;
  const target = c.target.kind === "model" ? `${c.target.model} with the policy as its system prompt` : `${c.target.name} (${c.target.agent ?? "agent"}) over HTTP`;
  if (summary.kind === "no_testable_rules") {
    return (
      <article className="tr-report">
        <h1>{summary.policyName}</h1>
        <p className="tr-lede">This policy contains no testable rules.</p>
        {summary.untestablePassages.length > 0 && (
          <>
            <p>Passages that sound normative but ask the agent to do nothing:</p>
            <ul>
              {summary.untestablePassages.map((p) => (
                <li key={p}>“{p}”</li>
              ))}
            </ul>
          </>
        )}
      </article>
    );
  }
  // While a run is executing, verdicts arrive in any order: keep the policy's order so cards do not jump between groups.
  const live = summary.partial || summary.rules.some((r) => r.verdict === "pending");
  const groups = live ? [] : ruleGroups(summary);
  const found = live ? [] : findings(summary);
  const defectCount = summary.defects.ambiguities.length + summary.defects.collisions.length;
  const plantedFound = summary.planted?.filter((p) => p.found === true).length ?? 0;
  const ruleLabel = (id: string) => {
    const r = byId.get(id);
    return r ? `Rule ${r.index}: ${r.statement}` : id;
  };
  return (
    <article className="tr-report">
      <header className="tr-head">
        <h1>{summary.policyName}</h1>
        <p className="tr-meta">
          Run {summary.runId} · agent under test: {target} · judged by {c.judgeModel} · {new Date(summary.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </p>
        {liveNote && <p className="tr-live">{liveNote}</p>}
      </header>

      <nav className="tr-jump" aria-label="Report sections">
        <a href="#tr-findings">Findings</a>
        <a href="#tr-map">How the rules read</a>
        <a href="#tr-defects">Policy defects ({defectCount})</a>
        {groups.length > 0 ? (
          groups.map((g) => (
            <a key={g.id} href={`#${g.id}`}>
              {g.title} ({g.cards.length})
            </a>
          ))
        ) : (
          <a href="#tr-rules">Rules</a>
        )}
        {summary.planted && (
          <a href="#tr-planted">
            Planted findings ({plantedFound} of {summary.planted.length})
          </a>
        )}
        <a href="#tr-run">Run details ({formatUsd(summary.strip.usd)})</a>
      </nav>

      <h2 id="tr-findings">Findings</h2>
      {found.length > 0 && (
        <ul className="tr-findings">
          {found.map((f) => (
            <li key={f.lead} style={{ borderLeftColor: f.color }}>
              <a href={f.href}>{f.lead}</a>: {f.detail.replace(/[.\s]+$/, "")}.{f.statement && <span className="tr-find-stmt">“{f.statement}”</span>}
            </li>
          ))}
        </ul>
      )}
      {!live && found.length === 0 && <p className="tr-lede-small">Every tested rule held, and the policy shows no ambiguities or collisions.</p>}
      {live && <p className="tr-lede-small">The summary of findings appears when the run completes.</p>}
      <SummaryStrip summary={summary} />
      <RunLine summary={summary} />

      <h2 id="tr-map">How the rules read</h2>
      <AmbiguityMap nodes={mapNodes(summary)} arcs={summary.map.arcs.map((a) => ({ id: a.collisionId, ruleA: a.ruleA, ruleB: a.ruleB, dismissed: a.dismissed }))} threshold={summary.map.threshold} linkPrefix="" />
      <Key
        items={[
          { label: "Holds", color: COLORS.good },
          { label: "Bends", color: COLORS.bent },
          { label: "Fails", color: COLORS.bad },
          { label: "Observed (a tradeoff)", color: COLORS.accent },
          { label: "Parked, not tested", color: COLORS.notRun, hollow: true },
          { label: "Collision", color: COLORS.bad, arc: true },
        ]}
      />

      <h2 id="tr-defects">Policy defects</h2>
      <p className="tr-lede-small">Problems in the policy itself, independent of the model: rules whose type the authors never settled, and pairs of rules that point opposite ways with nothing to say which wins.</p>
      {defectCount === 0 && <p>None found.</p>}
      {summary.defects.ambiguities.map((a) => (
        <section key={a.ruleId} className="tr-defect">
          <h3>Ambiguous: rule {byId.get(a.ruleId)?.index ?? a.ruleId}</h3>
          <p className="tr-statement">{a.statement}</p>
          {a.probabilities && (
            <p className="tr-small">
              Classifier: <Probabilities p={a.probabilities} />
            </p>
          )}
          <p>{a.summary}</p>
        </section>
      ))}
      {summary.defects.collisions.map((col) => (
        <section key={col.collisionId} className="tr-defect">
          <h3>
            Collision: rule {byId.get(col.ruleA)?.index ?? col.ruleA} vs rule {byId.get(col.ruleB)?.index ?? col.ruleB}
          </h3>
          <dl className="tr-dl">
            <dt>Rule A</dt>
            <dd>{ruleLabel(col.ruleA)}</dd>
            <dt>Rule B</dt>
            <dd>{ruleLabel(col.ruleB)}</dd>
            <dt>Situation</dt>
            <dd>{col.scenario}</dd>
            <dt>What the agent did</dt>
            <dd>
              {col.outcome
                ? col.outcome.honored === "a"
                  ? `followed rule ${byId.get(col.ruleA)?.index ?? "A"}`
                  : col.outcome.honored === "b"
                    ? `followed rule ${byId.get(col.ruleB)?.index ?? "B"}`
                    : col.outcome.honored === "both"
                      ? "satisfied both"
                      : "satisfied neither"
                : "not tested"}
            </dd>
            <dt>Why it is a defect</dt>
            <dd>{col.summary}</dd>
          </dl>
          {col.outcome?.evidence && (
            <Evidence
              scenarioId={col.outcome.scenarioId}
              quote={col.outcome.evidence}
              verified={col.outcome.verified}
              transcripts={transcripts}
            />
          )}
        </section>
      ))}

      <h2 id="tr-rules">Rules and what the tests found</h2>
      <Key
        items={[
          { label: "Holds: followed on every scenario", color: COLORS.good },
          { label: "Bends: partly gave way", color: COLORS.bent },
          { label: "Fails: did the forbidden act", color: COLORS.bad },
          { label: "Observed: a tradeoff, shown where behavior shifts", color: COLORS.accent },
          { label: "Parked: not tested", color: COLORS.notRun, hollow: true },
        ]}
      />
      {live
        ? summary.rules.map((card) => <RuleCardView key={card.ruleId} card={card} transcripts={transcripts} summary={summary} />)
        : groups.map((g) => (
            <section key={g.id} className="tr-group-wrap">
              <h3 id={g.id} className="tr-group">
                {g.title} <span className="tr-count">{g.cards.length}</span>
              </h3>
              {g.note && <p className="tr-group-note">{g.note}</p>}
              {g.cards.map((card) => (
                <RuleCardView key={card.ruleId} card={card} transcripts={transcripts} summary={summary} compact={g.compact} />
              ))}
            </section>
          ))}

      {summary.planted && (
        <details className="tr-fold" id="tr-planted">
          <summary>
            <h2>Planted findings (demo policy)</h2>
            <span className="tr-fold-meta">
              {plantedFound} of {summary.planted.length} found
            </span>
          </summary>
          <p className="tr-lede-small">Rule numbers here follow the demo policy&apos;s 13 hand-labeled rules. A run&apos;s decomposition can split the policy differently, so they may not match the rule cards above.</p>
          <table className="tr-table">
            <thead>
              <tr>
                <th>Planted</th>
                <th>Expected</th>
                <th>Found</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {summary.planted.map((p) => (
                <tr key={p.item}>
                  <td>{p.item}</td>
                  <td className="tr-small">{p.expected}</td>
                  <td>
                    <span className="tr-chip" style={{ color: p.found === true ? COLORS.good : p.found === false ? COLORS.bad : COLORS.notRun }}>
                      {p.found === true ? "found" : p.found === false ? "not found" : "—"}
                    </span>
                  </td>
                  <td className="tr-small">{p.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <details className="tr-fold" id="tr-run">
        <summary>
          <h2>Run details and cost</h2>
          <span className="tr-fold-meta">
            {formatUsd(summary.strip.usd)} · {formatInt(summary.strip.calls)} model calls · {formatMs(summary.strip.wallClockMs)} of testing
          </span>
        </summary>
        <table className="tr-table tr-compact">
          <tbody>
            <tr>
              <th>Agent under test</th>
              <td>{target}</td>
            </tr>
            <tr>
              <th>Model string</th>
              <td>{c.modelString}</td>
            </tr>
            <tr>
              <th>Test budget</th>
              <td>
                {formatUsd(c.spendCapUsd)} (spent {formatUsd(summary.strip.testUsd)} on tests, {formatUsd(summary.strip.analysisUsd)} on analysis)
              </td>
            </tr>
            <tr>
              <th>Concurrency · ambiguity threshold · ladder rungs</th>
              <td>
                {c.concurrency} · {c.ambiguityThreshold} · {c.rungs}
              </td>
            </tr>
            <tr>
              <th>Reasoning tokens</th>
              <td>{formatInt(summary.strip.reasoningTokens)} (billed as output)</td>
            </tr>
          </tbody>
        </table>
        <h3>Usage by stage</h3>
        <table className="tr-table tr-compact tr-num">
          <thead>
            <tr>
              <th>Stage</th>
              <th>Calls</th>
              <th>Input</th>
              <th>Cached</th>
              <th>Reasoning</th>
              <th>Output</th>
              <th>Cost</th>
              <th>Median latency</th>
            </tr>
          </thead>
          <tbody>
            {summary.usageByStage.map((u) => (
              <tr key={u.stage}>
                <td>{u.stage}</td>
                <td>{formatInt(u.calls)}</td>
                <td>{formatInt(u.inputTokens)}</td>
                <td>{formatInt(u.cachedTokens)}</td>
                <td>{formatInt(u.reasoningTokens)}</td>
                <td>{formatInt(u.outputTokens)}</td>
                <td>{formatUsd(u.usd)}</td>
                <td>{u.medianMs === null ? "—" : `${(u.medianMs / 1000).toFixed(1)} s`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {summary.untestablePassages.length > 0 && (
          <p className="tr-small">Set aside as not testable: {summary.untestablePassages.map((p) => `“${p}”`).join("; ")}</p>
        )}
      </details>
      {transcripts && Object.keys(transcripts).length > 0 && <TranscriptAppendix summary={summary} transcripts={transcripts} />}
    </article>
  );
}
