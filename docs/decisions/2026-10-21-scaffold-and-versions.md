# Scaffold, versions and interface amendments

**Decision.** These amend `docs/plan/architecture.md`. A review of npm, the next.js v16.4.2 source and openai-node v7.39.0 on 2026-10-21 found that the doc as written would break the scaffold or leave seams underspecified. The amendments:

1. **Scaffold.** `create-next-app@16.4.2 … --no-cache-components --no-agent-feedback --agents-md --disable-git --skip-install`. The 16.4 default `cacheComponents: true` turns the `dynamic` and `runtime` route exports that architecture §8–9 require into build errors.
2. **Versions.** `typescript` is pinned to exactly 5.9.3 (typescript-eslint rejects ≥ 6.1; npm `latest` is 7). `eslint` stays on 9 (eslint 10 breaks the react, import and jsx-a11y plugins in eslint-config-next). `@types/node@^22`. `engines.node >= 22.12`, because openai 7 and vitest 5 need it; the README says Node 22. The openai 7.0 breaking change is the Node 22 requirement, not Zod; `zodResponseFormat` accepts zod v4.
3. **Gate.** `typecheck` is `next typegen && tsc --noEmit` (`next-env.d.ts` and the route types are generated, not committed). vitest only collects `tests/**/*.test.ts`. `src/core` uses relative imports. dotenv is called with `quiet: true`. No top-level await in the CLI (p-limit is ESM-only).
4. **`PORT`** cannot be set from `.env`; it is a shell variable only.
5. **Ids.** Policies and runs get random 10-character base62 ids. Rules are `r{n}`, numbered monotonically within a run; split and merge take new numbers and `index` keeps display order. Scenarios are `r2-L5` (ladder), `r10-S3` (sweep), `r6-P4` (paraphrase), `r8-C1` and `c1-C1` (conflict), `r2-F1` (flat). Collisions are `c{n}`.
6. **Records.** `Run.totals` adds `analysisUsd`, `testUsd` and `reasoningTokens`. `UsageEvent` adds `provider`, `role`, `kind` (`call | retry | repair | length_retry`), `responseMode`, `usageEstimated` and `reportedByTarget`.
7. **Provider resolution.** `auto` tries Portkey, then OpenAI, then fails with "no key; use --provider mock". Never a silent mock.
8. **Length.** Every stage gets one retry at twice its output cap (at most 12,000 tokens) on `finish_reason: "length"` before any repair call. If the target is still cut off, the transcript is stored with `truncated: true`; an agent still cut off throws `SchemaInvalid`.
9. **Reporter** falls back to its templated sentence on a budget halt instead of halting the run. Route handlers that mutate (rules PATCH, collisions PATCH, confirm) write through `withRun` after a status check.
10. **Timeouts.** 90 s per request. The runtime model-string fallback is dropped; the probe decides once.
11. **Key budget.** `TENET_KEY_BUDGET_USD` (default 40) is checked against `data/usage-global.jsonl` before every live call: a warning event at 75 %, refusal at 95 % unless `TENET_ALLOW_OVER_KEY_BUDGET=1`.

**Why.** Each item either prevents a build or install failure found in the source (1–4), or fixes a seam that later days build on (5–11). The key-budget guard turns the professor's $40 warning, and the report's "overspending" risk, into code instead of a habit.
