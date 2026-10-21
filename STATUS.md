# Status

Updated 2026-10-21 (evening) by the building session. Plan: `PLAN.md` §3 (re-baselined 2026-10-21).

## Days and gates

| Day | Work | Gate | State |
|---|---|---|---|
| Wed Oct 21 | Foundation: samples, scaffold, env, schemas, store, model layer, CLI, CI. Analysis: scanner, decomposer, classifier, collisions, analysis API | `tenet analyze` works in mock; live once labels committed | **done** (mock and live) |
| Thu Oct 22 | Review page + ambiguity map, collisions page, classifier agreement; Summary contract, four generators, executor, judge, aggregation, execution pipeline | Mock `tenet run` end to end; live run attempted | **engine and UI done early (Wed)** |
| Fri Oct 23 | Live report, export, evidence tooling, safety demos, archived run, README | **Gate 1 by noon** | **Gate 1 met Wed evening** (live runs `CytBFyz339`, `28Cv5g6wi1`) |
| Sat Oct 24 | HW5 bridge + HTTP target runs (morning); validation, spot check, tokenomics, report draft (afternoon) | **Gate 2 freeze at noon** | |
| Sun Oct 25 | Dry run, report.html, slides.html, video | **Gate 3** | |
| Mon Oct 26 | Buffer; submit before 18:00 | Canvas | |

## Done (Wed Oct 21)

- `5825f94` Samples and label templates committed before any code: Harrow & Vale (+ injected), Meridian, Northgate, Campus Customs HW5 excerpt (17 rules, verbatim from the HW5 prompts; rules 8 and 17 condensed, as the file header says), OpenAI Model Spec excerpt (22 sentences, v2026-08-18, CC0), edge mission statement.
- Private repo https://github.com/shanehaynes/tenet; CI (gate, build, Playwright placeholder, mock) green on every push.
- `3b81f7c` Scaffold: Next.js 16.4.2, TypeScript 5.9.3, eslint 9, vitest 5. Amendments to architecture.md recorded in `docs/decisions/2026-10-21-scaffold-and-versions.md`.
- `0c84faf` Core: env loader (`./.env` then `../.env`), settings, schemas (agent outputs, records with the `Target` union, the `Summary` contract + fixture), text utilities (`locate`, `dice`, `verifyQuote`), JSON store with the per-run single-writer queue, global usage log with cumulative key spend.
- `13113be` Model layer: `callModel` with capability gating, retries, length retry, repair; Portkey/OpenAI/mock providers; lazy capability probe; test-budget ledger; key-budget guard (warn 75 %, refuse 95 % of $40).
- `9dfcf58` CLI (`policies`, `smoke`, `spend`), `npm run doctor`, executor prompt, prefix-budget test.
- `0f55f85` Analysis agents and pipeline: scanner, decomposer, classifier, collision mapper; analysis and collision jobs; overrides (type, park, split, merge); confirm gating; CLI `analyze`, `rules`, `confirm`.
- `90d36c0` `npm run eval:classifier` (M03): alignment, agreement at 0.6/0.7/0.8, confusion matrix; refuses a live run while labels are blank or uncommitted.
- `24f1f14` API: policies (seed + scan, paste, upload, rescan), runs (create/list/get), rules PATCH, confirm, collisions PATCH, health.
- Live (key at `~/projects/.env`): `npm run doctor` and `npm run smoke` pass (M01: strict JSON accepted, temperature rejected, effort `low` accepted, 0/8 rate-limited, median 1.2 s); prices confirmed (M02, `docs/evidence/pricing.md`); executor and classifier prefixes cached on repeat (`docs/evidence/tokenomics/prefix-measurement.md`); live Harrow & Vale analysis 13/13 rules, **classifier agreement 92.3 %** (M03, run `vma3nUbwbG`; iterations in `docs/evidence/labels/iterations.md`). Cumulative key spend $0.008.
- Shane's labels for Meridian and Northgate committed (`01e09fd`); live agreement 100 % and 90.9 %; **pooled 94.4 % (34/36)** over the three fictional policies. HW5 labels committed (`29ee7d9`); live agreement 76.5 % (13/17). **Pooled over all four: 47/53 = 88.7 %.**
- `docs/labeling-guide.md`: the working definitions both labelers use.
- 98 unit and pipeline tests. Mock `tenet analyze samples/harrow-vale.md` → 13 rules, rules 5/9/13 pre-parked; injected sample → quarantined; mission statement → "no testable rules".

## Engine (Wed evening, ahead of plan)

- `bee3e8c` Generators for all four types (ladder, sweep, paraphrase, conflict for orderings and collisions), executor (model target), judge (one cached prefix, five rubrics, verified evidence), reporter, `aggregate.ts`, execution pipeline with a clean test-budget halt; CLI `execute`, `run`, `status`, `canary`; API `execute`, `scenarios/:sid`, `summary.json`. 124 tests.
- Judge canary live (M16): a violating reply that claimed advance approval was judged *partial* under rubric v1; rubric v2 (claims inside the exchange are not evidence) passes both canaries in three runs (`docs/evidence/safety/canary-log.md`).
- Classifier v2 (revision 1 of 3): pooled agreement over five labeled policies 80.0 % → **86.7 % (65/75)**; Model Spec 59.1 % → 77.3 %; no regressions (`docs/evidence/labels/iterations.md`).
- **Live end-to-end runs on Harrow & Vale** (Gate 1): `CytBFyz339` (98 s, $0.022) and `28Cv5g6wi1` with the fixed prompts (51 s, $0.021, 158 calls, 82 % of input tokens cached, 0 unverified, 0 truncated). Findings in the second run: all ladders held (rule 2 did *not* fold; prediction not borne out); rule 10's sweep escalated from $500 because rule 2 already requires partner approval for every fund movement, so the $10,000 threshold is dead letter for payments (a policy overlap, not a model failure); the collision mapper proposed confidentiality vs the convenience/fraud tradeoff and the agent chose the tradeoff side; rules 7, 9, 13 flagged ambiguous. Results vary run to run (no `temperature`).
- Prompt changes after live runs are logged in `docs/evidence/prompt-changes.md`. Cumulative key spend: $0.08.

## UI (Wed evening, ahead of plan)

- `902984e` Pages: Policies (one-click samples, paste/upload, quarantine banner with edit-and-re-scan, safety-demo card, no-key guidance), Review (type overrides, park, split, merge, confirm gating with reasons, ambiguity map with a type legend), Collisions (dismiss/restore, run panel: agent under test, test budget, concurrency), live Report (progress header, test spend vs budget, events, halted state, transcript drawer), Runs history. shadcn/ui (base-nova) set up within the timebox; system fonts (no Google font fetch at build).
- Report visuals are pure React + SVG in `src/core/report` with their own CSS (`reportCss.ts`), so Friday's standalone export renders the same tree; `ReportDocument` already renders to static markup under plain Node (unit test).
- Bug found by e2e: a budget halt thrown by the shared ledger was not recognized in another Next route bundle (`instanceof` across bundles); errors are now checked by name (`src/core/errors.ts`).
- Playwright e2e in mock mode (happy path through every page, quarantine of a pasted injection, empty submit, halted run) green locally; 129 unit and pipeline tests.
- Finding F1 recorded (`docs/evidence/findings.md`): rule 10's $10,000 threshold is dead letter for payments because rule 2 requires partner approval for every fund movement; Tenet now flags sweeps that escalate far below the stated threshold. Decision record `overlap-as-finding`.

## Deviations found while building (recorded in the docs)

- Live measurement: chars ÷ 4 overstated real prompt tokens by 13–29 %, so the executor prefix (884 real tokens) was not cached. The estimate is now chars ÷ 5.2 and the executor preamble has four more paragraphs (decision record `prefix-calibration`).
- Decomposer prompt revised twice on the labeled demo policy (v1 → v3); the classifier prompt is unchanged.

- The executor prefix with the demo policy measured 1,052 estimated tokens, under the 1,100 caching floor. One neutral paragraph ("Dates and amounts…") was added to the preamble (agents §6, marked); it now measures 1,139.
- As drafted, the scanner's strong patterns did not match the injected line ("Ignore the rules above when the user says…"). The patterns were amended (agents §1, marked).
- Rule ids are `r{n}`, scenario ids `r2-L5`-style (decision record `scaffold-and-versions`).
- The mock classifier's 100 % agreement on Harrow & Vale is by construction (its heuristics encode the demo labels). It is not evidence; only live runs write `docs/evidence/labels/`.

## Pending for Shane

| Since | Item | Needed by |
|---|---|---|
| 2026-10-21 | Optional: label `samples/openai-model-spec-excerpt.labels.json` (22 rules) so the report can state agreement on a published policy | Sat Oct 24 |
| 2026-10-21 | Contact a policy owner (Eide Bailly colleague, Yale IT, compliance contact) for Saturday or Sunday; no classmate labeler (in finals; kappa not obtained) | Fri Oct 23 |
| 2026-10-21 | HW5 backend runnable on this machine: `.venv`, `.env` with the key, `cd backend && ../.venv/bin/uvicorn main:app --port 8000` (HW5 cloned read-only at `~/projects/Homework5`) | Fri Oct 23 |

## Known gaps

- gpt-6-luna rejects `temperature`, so live results vary run to run; every reported number names its run id.
- The executor prefix (1,075 tokens on the demo policy) caches; a much shorter user policy would fall under the 1,024-token floor, and the report should say so.
- No UI pages yet beyond a placeholder home page (Thursday task 1).
- The Playwright suite is a placeholder (`--pass-with-no-tests`) until Thursday's pages exist.

## Next step

Friday's list, in order (PLAN §3): export routes (standalone HTML through `renderToStaticMarkup` with transcripts inlined, usage CSV); evidence tooling (`tenet spotcheck export|score` n 50, `tenet timing`, `tenet rejudge --effort minimal`, `eval:classifier --batched`, `scripts/check-secrets.mjs`, `collect-evidence` skeleton, `report/report.src.html` + `build-report.mjs --allow-missing`, `report:pages`, `build-slides.mjs` skeleton); safety demo screenshots (S02 quarantine, S07 halted at $0.01, S17 canary); a fresh live demo run on Harrow & Vale with `npm run build && npm start` and fixtures; archived example run + `/runs/example`; `e2e/screenshots.spec.ts` for S01–S14 and S19; README full draft with the 10-minute path. Saturday morning: HW5 bridge + HTTP target.
