// Token estimate for English prompt text, calibrated on 2026-10-21 against gpt-6-luna's reported prompt
// tokens (scripts/measure-prefixes.ts): the executor prefix measured 5.18 characters per token and the
// classifier prefix 4.53. Dividing by 5.2 errs low, so a prefix that clears the floor by this estimate
// clears it in reality. (The original chars ÷ 4 overestimated by 13–29 % and let an uncacheable prefix pass.)

export const CHARS_PER_TOKEN = 5.2;

/** OpenAI caches only prompt prefixes of 1,024+ identical tokens; this floor leaves a margin above that. */
export const PREFIX_TOKEN_FLOOR = 1050;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
