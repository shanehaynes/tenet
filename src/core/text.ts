import type { Span } from "./schemas/records";

// Text utilities shared by the decomposer (locating quotes), the eval script (aligning rules) and the judge
// (verifying evidence). Models cannot produce reliable character offsets, so spans are always found here.

const QUOTE_SINGLE = /[‘’‚‛′´]/;
const QUOTE_DOUBLE = /[“”„‟″«»]/;
const DASH = /[‐‑‒–—―−]/;
const DROP = new Set(["*", "`"]); // markdown emphasis and code ticks

function normalizeChar(ch: string): string {
  if (QUOTE_SINGLE.test(ch)) return "'";
  if (QUOTE_DOUBLE.test(ch)) return '"';
  if (DASH.test(ch)) return "-";
  if (ch === "…") return "...";
  return ch.toLowerCase();
}

/**
 * Normalizes for comparison (lowercase, straight quotes, plain dashes, markdown emphasis removed, whitespace
 * collapsed) and returns, for each normalized character, the index of the original character it came from.
 */
export function normalizeWithMap(input: string): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (DROP.has(ch)) continue;
    if (/\s/.test(ch)) {
      pendingSpace = text.length > 0;
      continue;
    }
    if (pendingSpace) {
      text += " ";
      map.push(i);
      pendingSpace = false;
    }
    for (const out of normalizeChar(ch)) {
      text += out;
      map.push(i);
    }
  }
  return { text, map };
}

export function normalize(input: string): string {
  return normalizeWithMap(input).text;
}

/** Word tokens after normalization; keeps digits, $ and % so "$10,000" stays comparable. */
export function tokenize(input: string): string[] {
  return normalize(input).match(/[a-z0-9$%][a-z0-9$%,.'-]*[a-z0-9%]|[a-z0-9$%]/g) ?? [];
}

/** Sørensen–Dice coefficient over token multisets, 0–1. */
export function dice(a: string[] | string, b: string[] | string): number {
  const ta = typeof a === "string" ? tokenize(a) : a;
  const tb = typeof b === "string" ? tokenize(b) : b;
  if (ta.length === 0 && tb.length === 0) return 1;
  if (ta.length === 0 || tb.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const t of ta) counts.set(t, (counts.get(t) ?? 0) + 1);
  let overlap = 0;
  for (const t of tb) {
    const c = counts.get(t) ?? 0;
    if (c > 0) {
      overlap++;
      counts.set(t, c - 1);
    }
  }
  return (2 * overlap) / (ta.length + tb.length);
}

export type Located = { span: Span; method: "exact" | "normalized" | "fuzzy"; score: number };

type PositionedToken = { token: string; start: number; end: number };

function positionedTokens(input: string): PositionedToken[] {
  const out: PositionedToken[] = [];
  const re = /[A-Za-z0-9$%][A-Za-z0-9$%,.'’-]*[A-Za-z0-9%]|[A-Za-z0-9$%]/g;
  for (const m of input.matchAll(re)) {
    const raw = m[0];
    const token = normalize(raw);
    out.push({ token, start: m.index, end: m.index + raw.length });
  }
  return out;
}

/** Finds a quote in the policy: exact, then normalized (offsets mapped back), then the best token window with Dice ≥ minFuzzy. */
export function locate(policy: string, quote: string, minFuzzy = 0.8): Located | null {
  const q = quote.trim();
  if (!q) return null;

  const exact = policy.indexOf(q);
  if (exact >= 0) return { span: { start: exact, end: exact + q.length }, method: "exact", score: 1 };

  const np = normalizeWithMap(policy);
  const nq = normalize(q);
  if (nq) {
    const idx = np.text.indexOf(nq);
    if (idx >= 0) {
      const start = np.map[idx];
      const end = np.map[idx + nq.length - 1] + 1;
      return { span: { start, end }, method: "normalized", score: 1 };
    }
  }

  const qTokens = tokenize(q);
  if (qTokens.length === 0) return null;
  const pTokens = positionedTokens(policy);
  const k = qTokens.length;
  let best: { score: number; from: number; to: number } | null = null;
  for (let size = Math.max(1, k - 3); size <= k + 3; size++) {
    for (let from = 0; from + size <= pTokens.length; from++) {
      const window = pTokens.slice(from, from + size).map((t) => t.token);
      const score = dice(qTokens, window);
      if (!best || score > best.score) best = { score, from, to: from + size - 1 };
    }
  }
  if (!best || best.score < minFuzzy) return null;
  return { span: { start: pTokens[best.from].start, end: pTokens[best.to].end }, method: "fuzzy", score: best.score };
}

/** Fraction of the shorter span covered by the overlap of two spans (0 when disjoint). */
export function spanOverlap(a: Span, b: Span): number {
  const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  if (overlap <= 0) return 0;
  return overlap / Math.min(a.end - a.start, b.end - b.start);
}

/** True when evidence appears verbatim in the reply after normalization (trailing punctuation ignored). */
export function verifyQuote(reply: string, evidence: string | null): boolean {
  if (!evidence) return false;
  const e = normalize(evidence)
    .replace(/^["'\s]+/, "")
    .replace(/["'.,;:!?\s]+$/, "");
  if (e.length === 0) return false;
  return normalize(reply).includes(e);
}

/** The markdown heading (### level or above) that governs a character offset, if any. */
export function sectionAt(policy: string, offset: number): string | null {
  let current: string | null = null;
  const re = /^#{1,6}\s+(.+?)\s*$/gm;
  for (const m of policy.matchAll(re)) {
    if (m.index > offset) break;
    current = m[1];
  }
  return current;
}
