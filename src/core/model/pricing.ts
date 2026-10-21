export type Prices = { inputPerM: number; cachedPerM: number; outputPerM: number };

export type TokenCounts = { inputTokens: number; cachedTokens: number | null; outputTokens: number };

/**
 * Cost from logged tokens (architecture §4.4). `outputTokens` is completion_tokens, which already includes
 * reasoning tokens (billed as output). Unreported cached tokens count as 0 (the log keeps them as null).
 */
export function usd(tokens: TokenCounts, prices: Prices): number {
  const cached = Math.min(tokens.cachedTokens ?? 0, tokens.inputTokens);
  const uncached = tokens.inputTokens - cached;
  return (uncached * prices.inputPerM + cached * prices.cachedPerM + tokens.outputTokens * prices.outputPerM) / 1e6;
}
