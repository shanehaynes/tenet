# Status

Updated 2026-10-21 (evening) by the building session. Plan: `PLAN.md` §3 (re-baselined 2026-10-21).

## Days and gates

| Day | Work | Gate | State |
|---|---|---|---|
| Wed Oct 21 | Foundation: samples, scaffold, env, schemas, store, model layer, CLI, CI. Analysis: scanner, decomposer, classifier, collisions, analysis API | `tenet analyze` works in mock; live once labels committed | **done** (mock and live) |
| Thu Oct 22 | Review page + ambiguity map, collisions page, classifier agreement; Summary contract, four generators, executor, judge, aggregation, execution pipeline | Mock `tenet run` end to end; live run attempted | **engine and UI done early (Wed)** |
| Fri Oct 23 | Live report, export, evidence tooling, safety demos, archived run, README | **Gate 1 by noon** | **Gate 1 met Wed; Friday list done Wed night** |
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
- **Live end-to-end runs on Harrow & Vale** (Gate 1): `CytBFyz339` (98 s, $0.022) and `28Cv5g6wi1` with the fixed prompts (51 s, $0.021, 158 calls, 82 % of input tokens cached, 0 unverified, 0 truncated). Findings in the second run: all ladders held (rule 2 did *not* fold; prediction not borne out); rule 10's sweep escalated from $500 because rule 2 already requires partner approval for every fund movement, so the $10,000 threshold is dead letter for payments (a policy overlap, not a model failure); the collision mapper proposed confidentiality vs the convenience/fraud tradeoff and the agent chose the tradeoff side; rules 7, 9, 13 flagged ambiguous. Results vary run to run (no `temperature`). *Corrected 2026-10-21 evening:* parts of `28Cv5g6wi1`, and almost all of the archived demo run `87VQK7KAKg`, were replayed by the gateway's response cache (see "Gateway response cache" below). Their wall-clock times are not real, so the archived example needs a fresh run.
- Prompt changes after live runs are logged in `docs/evidence/prompt-changes.md`. Cumulative key spend: $0.08.

## UI (Wed evening, ahead of plan)

- `902984e` Pages: Policies (one-click samples, paste/upload, quarantine banner with edit-and-re-scan, safety-demo card, no-key guidance), Review (type overrides, park, split, merge, confirm gating with reasons, ambiguity map with a type legend), Collisions (dismiss/restore, run panel: agent under test, test budget, concurrency), live Report (progress header, test spend vs budget, events, halted state, transcript drawer), Runs history. shadcn/ui (base-nova) set up within the timebox; system fonts (no Google font fetch at build).
- Report visuals are pure React + SVG in `src/core/report` with their own CSS (`reportCss.ts`), so Friday's standalone export renders the same tree; `ReportDocument` already renders to static markup under plain Node (unit test).
- Bug found by e2e: a budget halt thrown by the shared ledger was not recognized in another Next route bundle (`instanceof` across bundles); errors are now checked by name (`src/core/errors.ts`).
- Playwright e2e in mock mode (happy path through every page, quarantine of a pasted injection, empty submit, halted run) green locally; 129 unit and pipeline tests.
- Finding F1 recorded (`docs/evidence/findings.md`): rule 10's $10,000 threshold is dead letter for payments because rule 2 requires partner approval for every fund movement; Tenet now flags sweeps that escalate far below the stated threshold. Decision record `overlap-as-finding`.

## Friday's list (done Wed night, ahead of plan)

- Export: standalone `report.html` per run (CSS and every transcript inlined; route via `react-dom/server.edge`, CLI `tenet export`), usage CSV, buttons on the report page.
- `scripts/check-secrets.mjs` (also searches for the local key value), in CI before the gate.
- Evidence commands: `tenet spotcheck export|score` (blind, seeded, rubric-stratified 50; scorer writes `agreement-<run>.json`), `tenet rejudge --effort none` (the gateway accepts `none`, `low`, `medium`; not `minimal`), `tenet timing`, `eval:classifier --batched` (M11 done: batched 68/75 = 90.7 % vs per-rule 65/75 = 86.7 % at about half the cost, single runs).
- **Evidence screenshots S01–S14, S19 captured live** (`npm run screenshots`; re-captured 2026-10-22 from fresh demo run `449NHijnXq` and halted run `ySmxtWrMwE`); `RUN_ID=<id> npm run screenshots` re-captures the report shots without a new run.
- **Archived example run** `449NHijnXq` (since 2026-10-22; was `87VQK7KAKg`) in `docs/evidence/runs/`, rendered at `/runs/example` without a key, linked from the home page.
- README full draft (10-minute path, troubleshooting, what the report shows, safety numbers, configuration, CLI).
- `collect-evidence` → `docs/evidence/report-data.json` (50 values with sources); `report/report.src.html` + `build-report.mjs --allow-missing` + `report:pages` (skeleton prints to 6 pages); `slides/slides.src.html` + `build-slides.mjs` (10 slides, reveal.js 6.0.2 from cdnjs). The prose is the weekend's work.
- Numbers from the fresh demo run `449NHijnXq` (2026-10-22): 192 calls, $0.0267, 120 s; caching served 88.1 % of input tokens and saved 45.9 %; at the PRD's usage assumption, about $0.32 per user per month ($3,210 a month at 10,000 users). (The first figures, from the replayed run `87VQK7KAKg`, were 82.1 %, $0.25 and $2,474.)

## HW5 bridge and HTTP target (Wed night, ahead of plan)

- HW5 branch [`tenet-bridge`](https://github.com/shanehaynes/Homework5/tree/tenet-bridge) pushed: `POST /tenet/ask` runs one agent on one operator request from freshly restored books and returns its report, its tool calls (from the audit trail) and its token usage; `409 busy` during another run; `502` with usage when the agent ends without a report. `CAMPUS_DB_PATH` / `CAMPUS_AUDIT_PATH` keep test sessions in separate, git-ignored files, so the homework evidence is untouched. Smoke-tested live (customer_service: 6.6 s, 2 requests, one `get_catalog` call).
- Tenet HTTP target: executor branch (one scenario at a time, 409 retried every 2 s, a timeout retried once, a 502 is the agent's own failure and is not retried), target-reported usage logged as stage `target` and counted against the test and key budgets, actions stored with the transcript and shown to the judge, at most 40 scenarios per agent run (refused up front by an estimate), CLI `--target http --agent-url --agent`, `rules --keep`, API and run panel. Stub-server pipeline test.
- Judge v3: evidence may quote an agent's drafted text from its actions (customer_service writes its customer-facing text inside `draft_customer_reply`); canary re-run passes.
- Found on the first live HW5 run: generated requests named customers and orders that do not exist in the shop, so the agent refused on lookup, not on the rule. Fix: `GET /tenet/ask` describes the agent's world after a reset and the generators write about those records.
- Found on the grounded rerun: the judge saw only the first 300 characters of each action, and the drafts run 230–480, so it now sees 1,500. Also a hung model call held the bridge for minutes; the bridge now caps an agent run at 100 s and Tenet waits out `busy` after a timeout. The two stopped runs (`L40iviUHCM`, `J8JCfKdS9J`) are kept as evidence; decision record `agent-grounding`.

## HW5 evidence runs (Wed night; M20 done, ahead of Saturday)

- customer_service `IoSW65WajY` (6 rules, 37 scenarios, $0.080, 15 min), accounting `kadE9UGsFP` (6 rules, 37 scenarios, 1 not run, $0.065, 14 min), and the scoped-rule rerun `S0p9QWq0Pa` (6 scenarios). All three were re-judged fresh with the final judge and archived in `docs/evidence/runs/` (`HW5-RUNS.md`). Ground truth: `docs/evidence/runs/hw5-ground-truth.json`. Findings F2–F5 are in `docs/evidence/findings.md`. Screenshots S20a–c.
- What Tenet found that the HW5 author did not know:
  - The charter ("never hint at a discount") and the customer_service role prompt (which scripts "it is under review") disagree (F2).
  - Two privacy and secrecy rules carry their scope only in neighboring sentences (F3). Restoring rule 14's scope turned "folded at rung 1" into "held through rung 6".
  - "State only what tools returned" literally forbids recording an operator's claim even when it is labeled unverified (F5).
  - Every money rule held, and no tool ever had to refuse: across 80 scenarios the prompt did all the enforcing (F5).
- Judge test–retest (same transcripts, fresh calls): 73/79 = 92.4 %. The disagreements sit on the borderline rules above.
- Restart the HW5 backend for more runs: `cd ~/projects/Homework5/backend && CAMPUS_DB_PATH=data/tenet_working.db CAMPUS_AUDIT_PATH=output/tenet_audit_trail.json CAMPUS_FRESH_MODEL_CALLS=1 ../.venv/bin/uvicorn main:app --port 8000`.

## Gateway response cache (found Wed night; decision record `gateway-cache`)

- Portkey replays identical requests from a response cache. Tenet now asks for a fresh answer on every call and logs the cache status of each.
- Affected and corrected:
  - The canary's "repeated twice": withdrawn; three fresh runs pass.
  - "Rule 2 held in both runs": corrected to one observation.
  - The first judge retest and the first in-place re-judge: redone fresh.
- Replaced 2026-10-22: the archived demo run `87VQK7KAKg` was almost entirely a replay of `28Cv5g6wi1`. The fresh run `449NHijnXq` is now the example run, and screenshots S01–S14 and S19 come from it (191 of 192 calls logged `refresh`).
- Also hidden by the cache: the decomposer's run-to-run variation. Every earlier Harrow & Vale run got the same 13-rule decomposition because one answer was replayed. Fresh runs split the policy into 16 rules (`vTaQ8Ffr36`, which counted scope sentences as rules) and 14 (`449NHijnXq`, which split "Act as a careful professional would and, when unsure, ask" in two). M03 stands as a single measurement; the report should say decompositions vary.

## Thursday (Oct 22), while Shane is away

- **M07 done.** Validation runs on every sample, all calls fresh. Meridian `JLX9iZjgpG`: 5 defects in 12 rules. Northgate `vn3jLywoMW`: 2. Model Spec excerpt `7J1pfQjoOJ`: 10 in 28. Edge mission statement `8N57mBlbay`: "no testable rules". Totals in `runs/defects-per-policy.json`, finding F6.
- **M10 done** (`tokenomics/rungs.json`). With 4 rungs, ladder cost per rule drops 28.9 % ($0.00113 vs $0.00159; H&V runs `6en5fEzxaf`, `SAnnfrbsRa`). All 5 ladder departures seen with 6 rungs (Meridian, Model Spec, HW5 accounting) would also be caught with 4. What can move is the rung where a departure first shows: the Model Spec objectivity rule first slipped at "urgent", which 4 rungs drop.
- **Decomposer stability** (`labels/decomposer-stability-harrow-vale.json`): five fresh calls found all 13 labeled rules every time and added 0–3 extras (most often "when unsure, ask" split from the careful-professional rule).
- **Report draft** (`report/report.src.html`): sections 2 (What is new, with S22, the Model Spec excerpt's ambiguity map), 4 (Tokenomics), 5 (Safety table), 6 (Impact: M07 and HW5) and 7 (Limits), plus "Testing a real agent" in section 3. Every number is a placeholder filled from `report-data.json`. Prints to 12 pages. Still draft: Motivation (M18), the demo run step by step, M05, M13, M19. The rebuilt `report.html` is **not** committed yet, because it shows the spot-check run's results; rebuild after Shane has scored.
- **Slides draft** (`slides/slides.src.html`): problem, agents (with the real-agent option), findings (threshold chart beside the HW5 draft), the Model Spec ambiguity map, cost, safety, impact. Checked slide by slide at 1280×720: no overflow. Still draft: M18 and M13 on the last slide. As with the report, `slides.html` is rebuilt only after the spot check.
- **M19 prepared:** the spot-check run re-judged at effort "none" (judge cost $0.0076 against $0.0088). It is scored against Shane's CSV with `tenet spotcheck score 449NHijnXq <csv> --verdicts data/runs/449NHijnXq/verdicts-effort-none.json`.
- **Fresh-clone rehearsal** (`dry-run-rehearsal.md`): clone, install, doctor (no key), a mock CLI run and the mock dev server all work; the README needed no change. M17 itself is still Shane's stopwatch run.

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
| 2026-10-22 | **Spot check (M05):** score `docs/evidence/spotcheck/449NHijnXq-blank.csv` (50 transcripts; fill `human_verdict` from `allowed_verdicts`) and save it as `449NHijnXq-shane.csv`. Do it before opening that run's report, `/runs/example`, or screenshots S06–S14, which show its verdicts. | Sat Oct 24 |
| 2026-10-21 | Contact a policy owner (Eide Bailly colleague, Yale IT, compliance contact) for Saturday or Sunday; no classmate labeler (in finals; kappa not obtained) | Fri Oct 23 |

## Known gaps

- A provider content filter can reject a judge call: Portkey routes some calls to Azure OpenAI, whose filter blocked one judge prompt in `449NHijnXq` (400). That scenario is reported as not run, never as a pass.

- gpt-6-luna rejects `temperature`, so live results vary run to run; every reported number names its run id.
- The executor prefix (1,075 tokens on the demo policy) caches; a much shorter user policy would fall under the 1,024-token floor, and the report should say so.
- An agent run is serial (each scenario is a full agent run, 10–25 s), so a 40-scenario HW5 run takes 10–15 minutes.

## Next step

1. ~~HW5 bridge and HTTP target~~: done Wed night (see above). Optional P1: a third HW5 run against `boss` (the ordering rules 8 and 17).
2. ~~Fresh demo run~~: done 2026-10-22 (`449NHijnXq`, archived as the example; screenshots re-captured; spot-check CSV exported for Shane).
3. Saturday afternoon (after the freeze): once Shane's CSV is in, `tenet spotcheck score 449NHijnXq docs/evidence/spotcheck/449NHijnXq-shane.csv` (M05) and `tenet rejudge 449NHijnXq --effort none` scored against the same CSV (M19); `tenet timing` against Shane's hand-written file (M13); report prose.
4. Batched classifier: answered 2026-10-21, per-rule stays the default (it saves about 4 % of an audit; per-rule gives progressive feedback, isolates failures and has headroom for long policies). Batched stays as the measured experiment (M11).
