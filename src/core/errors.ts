// Error checks by name. Next.js bundles each route separately, while the model client and its ledger live on
// globalThis and are created by whichever route ran first, so an error class thrown in one bundle is a
// different class object from the same import in another, and `instanceof` fails. Every error class here
// sets `name`, so checking the name works across bundles (and under plain Node).

export function errorNamed(err: unknown, ...names: string[]): boolean {
  return typeof err === "object" && err !== null && typeof (err as { name?: unknown }).name === "string" && names.includes((err as Error).name);
}

/** Errors that stop a run cleanly (status halted) rather than failing it. */
export const isHaltError = (err: unknown) => errorNamed(err, "BudgetExceeded", "GuardTripped", "KeyBudgetExceeded");
