// Loop guards (architecture §7). No agent ever calls another agent; the orchestrator is plain code, and these
// hard caps bound what that code can do. The README's safety section quotes these numbers.

export const MAX_RULES_PER_RUN = 40;
export const MAX_SCENARIOS_PER_RULE = 12;
export const MAX_CALLS_PER_RUN = 600;

/** Per model call: one retry on a network error, 5xx or timeout; up to three waits on a 429. */
export const MAX_TRANSIENT_RETRIES = 1;
export const MAX_RATE_LIMIT_WAITS = 3;
/** Per model call: one retry at twice the output cap when the reply hits the token limit. */
export const MAX_LENGTH_RETRIES = 1;
/** Per model call: one repair request when structured output fails validation. */
export const MAX_REPAIRS = 1;
/** Output cap ceiling for the length retry. */
export const MAX_OUTPUT_TOKENS = 12_000;

export class GuardTripped extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardTripped";
  }
}
