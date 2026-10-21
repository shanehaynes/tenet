import { randomBytes } from "node:crypto";
import type { ScenarioKind } from "./schemas/records";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Random base62 id for policies and runs (rejection sampling, so no modulo bias). */
export function newId(length = 10): string {
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      const v = byte & 63;
      if (v < 62) out += ALPHABET[v];
      if (out.length === length) break;
    }
  }
  return out;
}

export function ruleId(n: number): string {
  return `r${n}`;
}

export function collisionId(n: number): string {
  return `c${n}`;
}

const KIND_LETTER: Record<ScenarioKind, string> = { ladder: "L", sweep: "S", paraphrase: "P", conflict: "C", flat: "F" };

/** Scenario ids read as their test: r2-L5 is rule 2's fifth ladder rung, c1-C1 the first scenario of collision 1. */
export function scenarioId(ownerId: string, kind: ScenarioKind, index: number): string {
  return `${ownerId}-${KIND_LETTER[kind]}${index}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
