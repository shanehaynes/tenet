import type { RunStatus } from "@/core/schemas/records";

/**
 * True when the run moved into one of `targets` while this page was open. A page opened on a later step
 * (from the stepper) stays put, so earlier steps can be revisited read-only.
 */
export function movedInto(initial: RunStatus, current: RunStatus, targets: readonly RunStatus[]): boolean {
  return !targets.includes(initial) && targets.includes(current);
}
