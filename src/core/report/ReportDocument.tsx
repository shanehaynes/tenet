import { RULE_TYPES } from "../schemas/agents";
import type { Transcript } from "../schemas/records";
import type { RuleCard, Summary } from "../schemas/summary";
import { AmbiguityMap, type MapNode } from "./AmbiguityMap";
import { LadderStrip } from "./LadderStrip";
import { formatCompact, formatInt, formatMs, formatUsd, scenarioColor, TEST_LABEL, VERDICT_LABEL, verdictColor } from "./palette";
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

function Evidence({ scenarioId, quote, verified, transcripts }: { scenarioId: string; quote: string; verified: boolean; transcripts?: Record<string, Transcript> }) {
  const t = transcripts?.[scenarioId];
  return (
    <div className="tr-evidence">
      <blockquote className={verified ? "tr-quote" : "tr-quote tr-unverified"}>
        “{quote}”{!verified && <span className="tr-flag"> unverified</span>}
      </blockquote>
      {t ? (
        <details className="tr-transcript">
          <summary>Transcript {scenarioId}</summary>
          {t.messages.map((m, i) => (
            <p key={i} className={`tr-msg tr-msg-${m.role}`}>
              <strong>{m.role === "user" ? "User" : "Agent"}:</strong> {m.content}
            </p>
          ))}
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

function RuleCardView({ card, transcripts, summary }: { card: RuleCard; transcripts?: Record<string, Transcript>; summary: Summary }) {
  const color = verdictColor(card.verdict);
  return (
    <section className="tr-card" id={`rule-${card.ruleId}`}>
      <header className="tr-card-head">
        <span className="tr-index">Rule {card.index}</span>
        {card.type && <span className="tr-type">{card.type}</span>}
        {card.testKind && <span className="tr-test">{TEST_LABEL[card.testKind] ?? card.testKind}</span>}
        <span className="tr-verdict" style={{ color, borderColor: color }}>
          {VERDICT_LABEL[card.verdict]}
        </span>
      </header>
      <p className="tr-statement">{card.statement}</p>
      {card.quote && card.quote !== card.statement && <p className="tr-source">Policy text: “{card.quote}”</p>}
      {card.ladder && <LadderStrip ladder={card.ladder} />}
      {card.sweep && card.type === "constraint" && <p className="tr-small">A constraint with a numeric trigger: tested by a stakes sweep across the trigger.</p>}
      {card.sweep && <ThresholdChart sweep={card.sweep} />}
      {card.paraphrase && <ParaphraseDots paraphrase={card.paraphrase} />}
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
          {card.probabilities && (
            <>
              {" "}
              Classifier: <Probabilities p={card.probabilities} />
            </>
          )}
        </p>
      )}
      {card.verdict === "designed_not_run" && <p className="tr-note">Designed, not run in this version: the {TEST_LABEL[card.testKind ?? ""] ?? "test"} generator was switched off.</p>}
      {card.headlineEvidence && <Evidence {...card.headlineEvidence} transcripts={transcripts} />}
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

export function SummaryStrip({ summary }: { summary: Summary }) {
  const s = summary.strip;
  const tiles: { label: string; value: string; tone?: string }[] = [
    { label: "Rules tested", value: `${s.rulesTested} of ${s.rulesTotal}` },
    { label: "Failing", value: String(s.failures), tone: s.failures ? "bad" : undefined },
    { label: "Bending", value: String(s.partials), tone: s.partials ? "bent" : undefined },
    { label: "Ambiguous", value: String(s.ambiguities), tone: s.ambiguities ? "accent" : undefined },
    { label: "Collisions", value: String(s.collisions), tone: s.collisions ? "accent" : undefined },
    { label: "Scenarios", value: `${s.scenariosTotal - s.scenariosNotRun} run${s.scenariosNotRun ? `, ${s.scenariosNotRun} not` : ""}` },
    { label: "Unverified", value: String(s.unverifiedCount) },
    { label: "Model calls", value: formatInt(s.calls) },
    { label: "Tokens in / cached / out", value: `${formatCompact(s.inputTokens)} / ${formatCompact(s.cachedTokens)} / ${formatCompact(s.outputTokens)}` },
    { label: "Cost", value: formatUsd(s.usd) },
    { label: "Test time", value: formatMs(s.wallClockMs) },
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
  return (
    <article className="tr-report">
      <header className="tr-head">
        <h1>{summary.policyName}</h1>
        <p className="tr-meta">
          Run {summary.runId} · agent under test: {target} · judged by {c.judgeModel} · {new Date(summary.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </p>
        {liveNote && <p className="tr-live">{liveNote}</p>}
      </header>

      <SummaryStrip summary={summary} />

      <h2>How the rules read</h2>
      <AmbiguityMap nodes={mapNodes(summary)} arcs={summary.map.arcs.map((a) => ({ id: a.collisionId, ruleA: a.ruleA, ruleB: a.ruleB, dismissed: a.dismissed }))} threshold={summary.map.threshold} linkPrefix="" />

      <h2>Rules and what the tests found</h2>
      {summary.rules.map((card) => (
        <RuleCardView key={card.ruleId} card={card} transcripts={transcripts} summary={summary} />
      ))}

      <h2>Policy defects</h2>
      <p className="tr-lede-small">Problems in the policy itself, independent of the model: rules whose type the authors never settled, and pairs of rules that point opposite ways with nothing to say which wins.</p>
      {summary.defects.ambiguities.length === 0 && summary.defects.collisions.length === 0 && <p>None found.</p>}
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
          <p className="tr-small">
            A: {byId.get(col.ruleA)?.statement} <br />
            B: {byId.get(col.ruleB)?.statement}
          </p>
          <p>
            <strong>Situation:</strong> {col.scenario}
          </p>
          <p>
            <strong>What the agent did:</strong>{" "}
            {col.outcome
              ? col.outcome.honored === "a"
                ? `followed rule ${byId.get(col.ruleA)?.index ?? "A"}`
                : col.outcome.honored === "b"
                  ? `followed rule ${byId.get(col.ruleB)?.index ?? "B"}`
                  : col.outcome.honored === "both"
                    ? "satisfied both"
                    : "satisfied neither"
              : "not tested"}
          </p>
          {col.outcome?.evidence && (
            <Evidence
              scenarioId={col.outcome.scenarioId}
              quote={col.outcome.evidence}
              verified={col.outcome.verified}
              transcripts={transcripts}
            />
          )}
          <p>{col.summary}</p>
        </section>
      ))}

      {summary.planted && (
        <>
          <h2>Planted findings (demo policy)</h2>
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
                  <td>{p.found === true ? "yes" : p.found === false ? "no" : "—"}</td>
                  <td className="tr-small">{p.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Run details</h2>
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
      {transcripts && Object.keys(transcripts).length > 0 && <TranscriptAppendix summary={summary} transcripts={transcripts} />}
    </article>
  );
}
