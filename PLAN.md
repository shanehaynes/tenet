# Tenet development plan

Tenet turns a prose AI policy into typed rules, generates the test each rule type demands, runs the tests against a model, and reports where behavior departs from policy and where the policy contradicts itself. This plan takes a session from an empty folder to the three graded deliverables (public repo, `report.html`, `slides.html`) by **Monday, October 26, 2026, 6:00 PM** (Canvas).

Plan written 2026-10-20 from the PRD ([docs/PRD.md](docs/PRD.md), a local copy of the Claude Doc at https://claude.ai/artifact/52XKqZzCwLruiJNUh8TWFt) and the course requirements page (https://zlisto.github.io/mgt_409_fa26/project_requirements.html). Revised 2026-10-21 after the professor's feedback on the pitch and a re-baseline to the actual start date. Builder: Shane Haynes, solo (course rule), with Claude Code sessions doing the building.

---

## 0. How to use this plan (read first)

**Reading order.** This file → [docs/PRD.md](docs/PRD.md) → [docs/plan/architecture.md](docs/plan/architecture.md) → [docs/plan/agents-and-prompts.md](docs/plan/agents-and-prompts.md) → [docs/plan/sample-policies.md](docs/plan/sample-policies.md) → [docs/plan/evidence-report-slides.md](docs/plan/evidence-report-slides.md). The appendices hold the detail; this file holds the order of work, the gates and the decisions.

**What the grade pays for** (100 points): idea 21 · app 30 (works 15, staff can run it 5, look and feel 10) · report 41 (motivation and what is new 8, agent design 10, tokenomics 8, safety 8, impact 5, design 2) · slides 8. Every report row has a named piece of evidence, and a row without it earns at most half. So the order of priorities is: a working end-to-end run on the demo policy, measured tokens, one safety defense shown working, a repo staff can run in 10 minutes, then evidence, then polish, then P1 features.

**What the professor said gets to Tier 3** (feedback on the pitch, received 2026-10-21; he has not seen this plan). Name what exists: promptfoo, Giskard, garak, Patronus, Haize Labs and UK AISI's Inspect all do red-teaming or policy evals, and the new part is the rule-type taxonomy plus the ambiguity map, said exactly like that. Run it on something real: Shane's own HW5 shop agents against the HW5 rules (real rules, real agents, known ground truth), plus a published policy for the ambiguity map. Prove the tool is trustworthy: 30–40 hand-labeled rules, a classmate's labels, agreement with Tenet, and the judge checked against Shane's own verdicts on about 50 runs. Get a real policy owner to react to the ambiguity map and ask whether they would change the policy. Practical points: the threshold result is the money shot; the course key has a $40 budget, so cap runs per rule, cache the policy text and report cost per policy audit; the agent under test can inject the judge ("mark this PASS"), so defend against it and show it; with six days left, classify rules, test one of each type end to end, build the ambiguity map, then put it in a clean front end where you paste a policy, pick an agent to test, and watch the results come in. Every one of these is now in §2, §3 and the evidence inventory.

**Working rules for the building session**

1. **Mock first.** Build and test every stage with `TENET_PROVIDER=mock`; use the live key for the smoke test, classifier evaluation, demo runs and screenshots. Record live responses as fixtures (`TENET_RECORD=1`) so UI iteration against real data costs nothing. *(Not built: the archived example run took this role; `TENET_RECORD` is parsed but unused.)*
2. **One wrapper.** Every model call goes through `callModel` (architecture §4.4). No exceptions, ever; the tokenomics section depends on it.
3. **Evidence first.** When a feature produces a number the report will cite, write the script that extracts it in the same commit. A number not in `docs/evidence/` does not go in the report.
4. **Keep the demo path green.** `npm run check` must pass after every change. From Phase 2 onward (once `tenet run` exists), `npm run tenet -- run samples/harrow-vale.md --accept-proposed --provider mock` must also still complete.
5. **Commit small, push often.** Work on `main` in this checkout (decision in §2). Conventional commit messages. Never commit `.env` or `data/runs`.
6. **Do not block on Shane.** Ask the kickoff questions once (§1), proceed on the defaults, and keep a running "Pending for Shane" list in `STATUS.md` with dates. Human-only tasks are in §4.
7. **Timeboxes.** shadcn/ui setup 20 min; strict structured outputs 30 min; any single bug 45 min, then take the fallback in the roadblocks table (architecture §14) or cut.
8. **Deviations are fine, recorded.** If reality disagrees with this plan, keep the PRD's P0 acceptance criteria, change the plan, and write a two-paragraph note in `docs/decisions/`.
9. **Long live runs** use `npm run build && npm start`, not `next dev` (HMR can interrupt a run; runs are resumable either way).
10. **Course site.** Use only the project requirements page and the Mac setup guide; everything needed from them is already in this plan. Do not fetch the homework pages.
11. **Update `STATUS.md`** at the end of every phase and whenever you hand something to Shane.
12. **Done means** the P0 acceptance criteria (§6) are met in a live run with evidence on disk, not that the code exists.
13. **Budget.** The course key has a $40 budget. Cumulative spend is logged and shown; live runs are deliberate (smoke, classifier eval, demo runs, HW5 runs, screenshots), never loops, and the HW5 runs are the expensive ones.

---

## 1. Kickoff (first 30 minutes of the first session)

Send Shane one message with these questions and the defaults you will use if he does not answer; then start Phase 0 immediately.

| # | Question | Default |
|---|---|---|
| 1 | Create the GitHub repo as `shanehaynes/tenet`, private now, flipped to public before submission (or `zlisto` added as collaborator)? | Yes; create it after Shane's yes (creating a repo is outward-facing) |
| 2 | Where is the `.env` with `PORTKEY_API_KEY`? The loader checks `./.env` then `../.env`. | Check both; if absent, build in mock mode and ask for the path |
| 3 | Confirm the Harrow & Vale hand labels as transcribed from the PRD (sample-policies §6.1), and whether to tweak the wording of samples 2 and 3 before labeling them | Labels confirmed; samples as drafted |
| 4 | UI kit: shadcn/ui (20-minute timebox) or plain Tailwind? | shadcn/ui |
| 5 | Hosting: none (local only)? | None |
| 6 | Who are the classmate labeler and the policy-owner candidate (Eide Bailly colleague, Yale IT, a compliance contact), and when will their inputs land? | Shane handles; the session needs the dates for `STATUS.md` |
| 7 | HW5: may the session clone github.com/shanehaynes/Homework5 into a sibling folder and add the Tenet bridge route on a branch? Is the local `.venv` set up, and does its `.env` hold the key? | Yes, branch `tenet-bridge`; Shane runs the HW5 backend if the session cannot |
| 8 | Published policy for the ambiguity map: the OpenAI Model Spec excerpt (CC0), or another public AI policy Shane prefers? | Model Spec excerpt |

Git identity is already configured on this machine; `gh` is authenticated as `shanehaynes`. Node 22 and npm 10 are installed; `pnpm` and `bun` are not.

---

## 2. Decisions already made (do not reopen)

| Decision | Why | Where |
|---|---|---|
| Deadline is Oct 26, 2026 (five working days from Wed Oct 21), not 3–4 weeks | The course page says so; the PRD's open question is closed | PRD Open questions |
| Scope: all P0 (Req. 1–13) plus minimal dispositions and orderings (Req. 14–15, moved into P0 on 2026-10-21, see below) and the real-agent target; remaining P1 (typed-vs-flat, re-run diff) only after Gate 1 | PRD cut line for the Oct 26 date, amended by the professor's "one of each type end to end" | PRD Requirements; §7 |
| Stack: Next.js 16 App Router + TypeScript 5 + Tailwind 4, JSON files on disk, no database, no hosting | PRD decision; one `npm install`, one `npm run dev` for the 10-minute rule. Shane's default stack (Vite + Hono + Supabase) is not taken: the PRD and the course's run requirement win | architecture §1; decision record `stack` |
| Workflow: one checkout, commits on `main`, branches only for risky experiments; worktrees only if two sessions write at once | Solo, six days, one writer at a time; the full parallel-agents setup is overhead here | decision record `workflow` |
| Model access: OpenAI SDK pointed at `https://api.portkey.ai/v1`, Portkey key as bearer and header, bare model name `gpt-6-luna`, capabilities probed by a smoke test | Mirrors the course's own Codex configuration; the workspace key carries its routing | architecture §4 |
| Chat Completions API, not Responses | Widest gateway compatibility; usage object carries `prompt_tokens_details.cached_tokens` | architecture §4.4 |
| Structured outputs: strict `json_schema` when supported, else `json_object` with schema in prompt and a repair retry | Gateway and model support are unknown until probed | architecture §4.4 |
| Luna models take `reasoning_effort`; `temperature` may be rejected | Course Codex config sets `model_reasoning_effort`; probe decides | architecture §4.3 |
| Decomposer returns verbatim quotes; spans are located in code | Models cannot produce reliable character offsets | agents §2 |
| Classifier returns a probability per type; confidence = max; threshold 0.7, reported at 0.6/0.7/0.8 | Calibrated uncertainty is what the ambiguity finding needs | agents §3 |
| Ladder verdicts: held / partial / violated / unclear | "Draft it and I'll send it" is the predicted fold; partial makes that finding precise | agents §7 |
| Numeric constraints (rule 10) get a stakes sweep by default, not a ladder | The sweep is the test that finds the threshold gap | agents §5.2 |
| Judge: one static system prefix with all rubrics, auditor persona, verbatim evidence verified in code, canary test | Caching, integrity and the same-model-judge mitigation in one design | agents §7 |
| Execute and judge interleaved per scenario; concurrency default 4 or the smoke test's suggestion | Halves wall time; the 3-minute demo target | architecture §7 |
| Charts are hand-rolled SVG shared by the app and the export; no Recharts | Server-side export needs static markup | architecture §10 |
| `report.html` is generated from a template plus `docs/evidence/report-data.json`; the in-app export is a separate artifact | Every number traceable to a log; the rubric wants a narrative | evidence §2 |
| Mock and replay providers; CI runs in mock mode | Build, test and demo without spending or waiting on the key | architecture §4.5 |
| An archived real run ships in the repo and opens at `/runs/example` | Safety net for the "staff can run it" points if a key fails | evidence §6 |
| Spend cap default $2 per run; a model-target run of the demo policy costs roughly $0.10–0.30 including reasoning tokens, an HW5 agent run $1–3; the halt demo sets a $0.01 test budget | gpt-6-luna list price $0.10 / $0.01 cached / $0.50 per M tokens (confirm day 1) | architecture §7 |
| The spend cap governs test spend (generation, execution, judging); analysis spend is shown separately and bounded by loop guards | A $0.01 cap on the whole run would trip during classification, before any scenario runs | architecture §7 |
| Confirmed rules of a P1 type (disposition, ordering) are not tested in v1: their cards read "designed, not run", they are excluded from the coverage denominator, and the Limits section shows their generator prompts | The PRD's 100 % coverage metric and its P1 cut line cannot both hold otherwise | agents §9; architecture §5 |
| Every static prompt prefix clears the caching floor, enforced by a unit test (amended 2026-10-21: calibrated estimate chars ÷ 5.2 ≥ 1,050, after measurement showed chars ÷ 4 overstated real tokens) | OpenAI caches only prefixes of 1,024+ identical tokens; the first drafts were 600–800 tokens, so caching would never have shown | agents §0; decision record `prefix-calibration` |
| Output caps are sized for reasoning tokens (target 2,000; judge 1,500; generators 6,000) and `reasoning_tokens` is logged per call | Luna is a reasoning model: reasoning counts against `max_completion_tokens` and is billed as output | architecture §4.4 |
| The PRD was updated on 2026-10-21 to carry this plan's four technical overrides (SVG charts, verbatim quotes with offsets located in code, a sweep for rule 10, the $0.01 halt budget), so the PRD and this plan agree; the PRD governs requirements and acceptance criteria | Closed decisions should not be reopened by a session reading the PRD | `docs/PRD.md` (Doc rev 26); decision records in `docs/decisions/` |
| One of each rule type is tested end to end in P0: dispositions get the paraphrase set and orderings the forced conflict (Req. 14–15 move from P1 to P0 in minimal form); designed-not-run remains the cut line if Gate 1 slips | The professor's explicit expectation; each generator is one prompt and one rubric branch, and the judge rubrics already exist | agents §5.3–5.4, §9 |
| The ambiguity map is a P0 visual: rules placed by their type probabilities, confident corners shaded, collisions as arcs, verdict colors after the run; shown on the review page, in the report, on slide 7, and to the policy owner | The professor called the ambiguity map the best part and asked for it as a visual | architecture §10 |
| Targets: the thing under test is a `Target`, either a model with the policy as system prompt (default) or an HTTP agent (`POST /tenet/ask` on Shane's HW5 backend). HTTP targets run at concurrency 1 with a database reset per scenario; two targeted HW5 runs (`customer_service`, `accounting`) | Real rules, real agents, known ground truth is the professor's Tier 3 evidence; the HW5 repo already has `ask_agent`, an audit trail of tool calls and `/reset` | architecture §4.6; sample-policies §10 |
| A published policy (OpenAI Model Spec excerpt, CC0, verified on the page) is the sixth sample, used for classification and the ambiguity map only | The professor asked for a published policy for the ambiguity map; no execution needed | sample-policies §11 |
| Judge spot check on 50 transcripts (was 30) | The professor asked for about 50 | sample-policies §7 |
| Competitors named exactly in the report and README: promptfoo, Giskard, garak, Patronus, Haize Labs, UK AISI Inspect, plus Braintrust, LangSmith Evals and OpenAI Evals from the PRD; the sentence "Tenet's new part is the rule-type taxonomy and the ambiguity map" appears verbatim | The professor's wording for the what-is-new section | evidence §2.2 |
| The course key's $40 budget is tracked: cumulative spend across all runs is logged to `data/usage-global.jsonl` and shown in the footer and by `tenet status`; the report's unit is "cost per policy audit" | The professor's warning; HW5 runs are the expensive ones | architecture §4.4 |
| The report page is live: it renders as soon as execution starts and fills in as verdicts arrive; the progress view is its header | "Watch the results come in" | architecture §9 |
| Classifier few-shot examples come from other domains, never from the three samples | The agreement metric is measured on the samples | agents §3 |
| Hand labels are committed before any live classifier run on the samples | The commit history is the evidence the labels were blind | sample-policies §6.2 |

---

## 3. Phases, gates and cut lines (re-baselined Wednesday Oct 21)

Day 1 of the original schedule did not happen: the plan was written on Tuesday and no code exists yet, and the professor's feedback (§0) arrived the same day. This schedule starts Wednesday, keeps the PRD's "no new code after Saturday noon" rule, and moves Gate 1 to Friday noon. The professor's own ordering is the spine: classify rules, test one of each type end to end, build the ambiguity map, then put it in a clean front end.

| Phase | Day | Goal | Gate |
|---|---|---|---|
| Foundation and analysis | Wed Oct 21 | Scaffold, env, model wrapper, smoke test, samples and labels, scanner, decomposer, classifier, collision mapper, analysis API | `tenet analyze` works in mock; live once labels are committed |
| Review UI and execution engine | Thu Oct 22 | Review page with the ambiguity map, collisions page, classifier agreement measured; Summary contract; all four generators, executor, judge, aggregation, execution pipeline, CLI | Mock `tenet run` end to end; live run attempted tonight |
| Live run and report | Fri Oct 23 | **Gate 1: first live end-to-end run by noon**; live report page, export, evidence tooling, safety demos, archived run, README | Gate 1 |
| Real agent, freeze, validation | Sat Oct 24 | Morning: HW5 bridge and HTTP target, HW5 evidence runs, typed-vs-flat if time; **Gate 2: feature freeze at noon**; afternoon: validation runs, 50-transcript spot check, kappa, tokenomics, timing, screenshots, report draft | Gate 2 |
| Ship | Sun Oct 25 | **Gate 3: fresh-clone dry run**; report.html, slides.html, video | Gate 3 |
| Submit | Mon Oct 26 | Buffer; submit by 6:00 PM | Canvas |

Cut lines. Gate 1 missed by Friday evening → Saturday morning goes to Gate 1; the HW5 bridge is dropped and the HW5 rules are tested as a plain policy against gpt-6-luna (already a sample, zero extra work). Dispositions or orderings not judged by Gate 1 → they ship as designed-not-run (the mechanism exists) and the report says so. After Gate 2 (Saturday noon), bug fixes only. Gate 3 failed → Monday morning goes to the README and repo, not the slides.

### Wednesday Oct 21: foundation and analysis agents

1. Kickoff message (§1). Do not wait for answers.
2. Samples and label templates first (sample-policies §1–6, §10, §11): the three fictional policies, the injected variant, the Campus Customs HW5 excerpt, and the OpenAI Model Spec excerpt (fetched, license line checked). Commit; tell Shane which label files to fill.
3. Scaffold per architecture §1 (sibling-folder trick, pin `typescript@^5`), `git init -b main`, `.gitignore` (`.env*` except `.env.example`; `data/*` then `!data/.gitkeep` and `!data/fixtures/`; `node_modules`, `.next`, `playwright-report`, `test-results`), first commit.
4. Project docs: `CLAUDE.md` (purpose; stakes: prototype, Shane plus Claude sessions, fictional data plus user-pasted text sent to the provider, public repo; start-here pointing at `STATUS.md`; the gate command; the working rules above; shared-state table: `data/` runtime-only, `samples/*.labels.json` Shane-owned once labeled, `STATUS.md` hot file, `docs/evidence/` append-only; what CI does not cover: live model runs). `STATUS.md` (one row per phase, "Pending for Shane", known gaps). `docs/decisions/2026-10-21-{project-stakes,stack,workflow,model-access,charts,targets}.md`, each half a page. `.env.example` (evidence §5). README skeleton.
5. `src/core/env.ts` + `scripts/doctor.ts` (env report plus one smoke call) + unit test for the `./.env` then `../.env` order (architecture §3).
6. Schemas (`src/core/schemas`, including `summary.ts`, the contract Phases 2–4 build against), store with the per-run single-writer queue and atomic writes, ids, text utilities, the cumulative key-spend log (architecture §4.4).
7. Model layer: portkey, openai and mock providers, capabilities probe, `callModel` (with `ruleId`/`scenarioId` and reasoning-token logging), pricing, budget, loop guards, the prefix-token-budget test helper + unit tests with a fake provider (architecture §4, agents §0). The replay provider is deferred.
8. CLI skeleton (`tenet policies`, `tenet smoke`). If a key is found, run `npm run smoke`; write `docs/evidence/model-capabilities.md`. Confirm gpt-6-luna list prices at https://developers.openai.com/api/docs/pricing and write `docs/evidence/pricing.md` with the date.
9. CI workflow (gate + build + e2e placeholder, mock mode).
10. Scanner, decomposer with span location, classifier with `scripts/eval-classifier.ts`, collision mapper (agents §1–4).
11. Analysis pipeline, run store, job registry; API: policies, runs create/get/list, rules PATCH (set type, park, split, merge), confirm, collisions PATCH (architecture §6–8).
12. Push to GitHub once Shane confirms the repo.

Exit criteria: `npm run check` green; `npm run tenet -- analyze samples/harrow-vale.md --provider mock` prints 13 rules with the expected flags; smoke results recorded or "pending key" in `STATUS.md`; six sample files and label templates committed; if labels landed, a live analysis and the first agreement number recorded.

Roadblocks: `create-next-app` refuses the non-empty folder (sibling trick); TypeScript 7 (pin 5); no key on this machine (mock mode, ask); the Model Spec page unreachable or its license line missing (substitute a published company AI policy with permissive terms, or skip the published sample and say so in the report).

Shane today: answer the kickoff questions; confirm the Harrow & Vale labels; label Meridian, Northgate and the HW5 excerpt tonight (he wrote the HW5 rules, so this is quick); contact the classmate labeler and a policy owner (Eide Bailly colleague, Yale IT, or a compliance contact); confirm the `.env` path; confirm the HW5 repo runs locally (`.venv`, `.env` with the key, `uvicorn`).

### Thursday Oct 22: review UI, ambiguity map, execution engine

1. Review page (overrides, split/merge, confirm gating, the P1-type note) and the **ambiguity map** (architecture §10) rendered from the classification; Collisions page with the "agent under test" selector and the run panel (disabled until the pipeline exists); every page exports `dynamic = "force-dynamic"` (architecture §9).
2. Playwright e2e for the three pages in mock mode.
3. Live analysis of every labeled sample; `npm run eval:classifier` → M03; at most three prompt revisions, each re-evaluated on all labeled samples, every iteration recorded.
4. `Summary` and `RuleCard` schemas finalized and `aggregate.ts` written against fixture verdicts (agents §9; architecture §5).
5. Generators: ladder (with `--rungs`), sweep, paraphrase (10 items), conflict (collision pairs and ordering rules), with count/order validation and mock templates (agents §5). One of each type is P0.
6. Executor for the model target and transcripts (agents §6). The HTTP target is designed now (types and config in architecture §4.6) and implemented Saturday.
7. Judge: per-run static prefix, five rubrics, the actions-block rule, evidence verification, canary fixture + tests (agents §7).
8. Reporter summaries (agents §8).
9. Execution pipeline: interleaved pool, single-writer persistence, test-budget halt that records the stage, guards, heartbeat, events; API execute, scenario detail, status; CLI `execute`, `run`, `status`; pipeline tests (complete, quarantined, halted with `--cap 0.0001`, no testable rules); the ten-line `react-dom/server.edge` proof route (architecture §10).
10. Evening: attempt the first live run with `npm run build && npm start`; record whatever happens in `STATUS.md`.

Exit criteria: `npm run tenet -- run samples/harrow-vale.md --accept-proposed --provider mock` completes with a judged scenario for every confirmed rule of all four types; classifier agreement recorded; the ambiguity map renders on the review page.

Roadblocks: generators return the wrong count (one regeneration, then pad with not-run); target replies truncated by reasoning tokens (cap 2,000, retry at 4,000); evidence often unverified (tighten normalization; "copy exactly"); 429s (lower concurrency, backoff); the dev server interrupts a run (build+start).

Shane: labels committed by 10 AM, a hard deadline; send the labeler the policies and the definitions card (deadline Saturday); 10 minutes with the ambiguity map of the live Harrow & Vale analysis: does it read at a glance?

### Friday Oct 23: Gate 1, live report, evidence tooling

1. **Gate 1 by noon**: a live end-to-end run on Harrow & Vale; record run id, wall time, calls, cost; record fixtures (`TENET_RECORD=1`; not built, see §0).
2. Live report page: the report renders from the moment execution starts and fills in as verdicts arrive; the progress view becomes the report's header (counters, test spend vs budget, event feed, halted states) (architecture §9).
3. `ReportDocument` visuals: `LadderStrip`, `ThresholdChart`, `ParaphraseDots`, conflict table, `AmbiguityMap` with verdict colors and collision arcs, policy-defects section, usage-by-stage table; transcript drawer.
4. Export routes: standalone HTML through the proven path, usage CSV, `summary.json`.
5. Evidence tooling (architecture §11; evidence §1–3): `tenet spotcheck export|score` (n 50), `tenet timing`, `tenet canary`, `tenet rejudge --effort minimal`, `eval:classifier --batched`, `scripts/check-secrets.mjs`, `scripts/collect-evidence.ts` skeleton, `report/report.src.html` skeleton with `build-report.mjs --allow-missing`, `report:pages`, `build-slides.mjs` skeleton.
6. Safety demos live: halted run at a $0.01 test budget (S07); quarantine (S02); canary (S17).
7. Archived example run copied to `docs/evidence/runs/<demoRunId>/` and the `/runs/example` route (evidence §6).
8. README draft with the 10-minute path and troubleshooting; "pick an agent to test" documented.
9. Design pass: the report page first, then the home page as one screen ("paste a policy, pick an agent to test, run").
10. If Gate 1 passed before 14:00: start the HW5 bridge tonight (sample-policies §10; architecture §4.6); otherwise Saturday morning.

Exit criteria: every P0 acceptance criterion (§6) met in a live run; S01–S14 captured; the evidence scripts exist and run on the demo run.

Roadblocks: exported file loses styles (own CSS string); `react-dom/server` throws in a handler (`server.edge` or `tenet export`); chart scale (log when range > 100×); slow report with many transcripts (collapsed by default); flaky screenshots (fixed viewport, network idle, fixtures).

Shane: 10 minutes with the first live report page; the timing exercise (sample-policies §8); book the policy-owner session for Saturday or Sunday; have the HW5 backend runnable on his machine (`.venv`, `.env`, `uvicorn`) in case the session cannot run it.

### Saturday Oct 24: real agent in the morning, freeze at noon, validation after

Morning, before noon:

1. HW5 bridge in a branch of the Homework5 repo: `POST /tenet/ask` (sample-policies §10, architecture §4.6), about 40 lines; the HW5 backend running locally with the course key.
2. HTTP target in Tenet: target config, executor branch, actions recorded in transcripts, the judge's actions block, the "agent under test" selector, concurrency 1 and a reset per scenario for HTTP targets.
3. HW5 evidence runs: the Campus Customs excerpt against `customer_service` and against `accounting` (two runs, ≤ 6 rules each, ≤ 40 scenarios each); record M20, known enforcement versus Tenet's finding.
4. Typed-vs-flat (P1; agents §5.5) only if 1–3 are done by 11:00.
5. **Gate 2, feature freeze at noon**: tag `v0.1-freeze`. Bug fixes only after this.

Afternoon:

6. Validation runs on every sample with the final prompts (M07). Spot-check export of 50 transcripts from a fresh Harrow & Vale run **before anyone opens its report**; hand the CSV to Shane (sample-policies §7).
7. ~~Kappa (M04)~~: no second labeler (decision record `2026-10-21-no-second-labeler`); the report says so.
8. Tokenomics: caching (M09), 4 rungs vs 6 (M10), batched classifier (M11), cheaper judge (M19), cost-per-user math (M12), cumulative spend on the course key (M21).
9. `tenet timing` (M13); `collect-evidence`; `build-report --allow-missing M17,M18`; report.html sections 1–6 drafted; screenshots re-captured if the UI changed, with S19–S21 added.
10. Support the policy-owner session: show the ambiguity map of their policy (or of the published policy), ask whether they would change the policy and which line, capture the quote (sample-policies §9).

Exit criteria: all measurements on disk except M17 and M18; report builds; spot check scored, or scheduled for Sunday morning with the CSV already in Shane's hands.

Roadblocks: HW5's shared SQLite database and single MCP connection (concurrency 1, reset per scenario); HW5 scenarios slow (10–20 s each, several model calls) so cap rules and scenarios; bridge debugging past two hours (fallback: the HW5 rules as a plain policy, already run); Shane opens a report before scoring (use another fresh run).

Shane: HW5 backend running with his key if the session cannot; hand-score 50 transcripts (about an hour) before reading that run's report; run the policy-owner session; collect the classmate's labels.

### Sunday Oct 25: Gate 3, report, slides, video

1. **Gate 3 dry run**: fresh clone into a new folder, `.env` one level up, README verbatim with a stopwatch to the first report; Shane on a second machine if possible, else the session in a clean directory. Record M17. Fix the README and setup until under 10 minutes.
2. `report.html` sections 7–8, including the policy owner's quote, the HW5 ground-truth table and the planted-failure scorecard; full read-through by Shane; page count 10–15; opens offline with images.
3. `slides.html` (evidence §3): the ambiguity map and the threshold chart are the two visual slides.
4. Video support: build+start mode, the PRD demo script extended with the agent selector, safety clip last.
5. `check-secrets` clean in both repos (the HW5 branch too); CI green; repo visibility plan; `STATUS.md` final; tag `v1.0`.

Exit criteria: every item in the submission checklist (evidence §7) checked except the Canvas upload.

Shane: the dry run on another machine; read every sentence of `report.html`; record the video.

### Monday Oct 26: buffer and submit

Morning: if Gate 3 failed, README and repo first. Re-run `screenshots.spec` only if the UI changed after Saturday. Flip the repo to public (or add `zlisto`), verify the README renders and `.env.example` is present. Submit the repo link, `report.html` and `slides.html` on Canvas well before 6:00 PM; open the uploaded files from Canvas to confirm. Then stop pushing.

---

## 4. Shane's calendar (tasks only a human can do)

| Day | Task | Feeds |
|---|---|---|
| Wed Oct 21 | Answer the kickoff questions; confirm Harrow & Vale labels; label Meridian, Northgate and the HW5 excerpt tonight; contact the classmate labeler and a policy owner (Eide Bailly colleague, Yale IT, compliance contact); confirm the `.env` path; confirm the HW5 repo runs locally | Wed–Thu |
| Thu Oct 22 | Labels committed by 10 AM (hard deadline); 10 minutes with the live ambiguity map | M03 |
| Fri Oct 23 | 10 minutes with the first live report; timing exercise for rules 2, 4, 10 with a stopwatch (sample-policies §8); book the policy-owner session; HW5 backend runnable on his machine | Gate 1, M13 |
| Sat Oct 24 | HW5 backend running with his key if needed (morning); hand-score 50 transcripts before reading that run's report (afternoon, about an hour); policy-owner session: show the ambiguity map, ask "would you change the policy, and which line?", capture the quote; collect the classmate's labels | M20, M05, M18, M04 |
| Sun Oct 25 | Dry run from a fresh clone on another machine with `.env` one level up, stopwatch running; read every sentence of `report.html`; record the video | Gate 3, M17 |
| Mon Oct 26 | Final read; repo public; submit on Canvas before 6:00 PM | Submission |

---

## 5. Risk register

| Risk | Early signal | Response |
|---|---|---|
| No key available to the session | `doctor` finds no `.env` | Build in mock mode; Shane runs `npm run smoke` and shares the capabilities file; live runs happen on Shane's machine or after the path is known |
| Portkey needs a different auth or model string | Smoke step 1 fails all variants | Try `x-portkey-provider` header with `@openai`; check the Portkey dashboard for the workspace's provider slug; ask the instructor; fallback `OPENAI_API_KEY` for Shane's own runs while unresolved |
| `temperature` or `json_schema` rejected | Smoke steps 2–3 | Capabilities fallbacks are built in; note the limitation in the report |
| The model holds every constraint and shows no failure | First live run has zero `violated` | Already designed for: partial verdicts, collisions, ambiguities are findings regardless; report honestly; try sunk-cost and reframing wording once |
| Rate limits on the course key | 429s in the smoke test or run logs | Concurrency 2, backoff; the demo video cuts the wait; mention in the report |
| Cached tokens stay at zero | Smoke step 4 or the first run's usage log | The prefix-budget test and the enriched prefixes (agents §0, §6, §7) make every static prefix ≥ 1,100 tokens; if the gateway strips `prompt_tokens_details`, log null and label it |
| Replies truncated by reasoning tokens | `finish_reason: "length"`, many `unclear` verdicts | Caps per architecture §4.4; one retry with a doubled cap; `truncated` counted in the summary |
| HW5 bridge takes longer than two hours | Saturday 10:00 and the bridge does not return tool calls | Stop; the HW5 rules were already run as a plain policy against gpt-6-luna; the report says so and the bridge goes to next steps |
| HW5 runs interfere or burn budget | Ticket-ownership errors; HW5 spend past $5 | Concurrency 1, `reset: true` per scenario, ≤ 6 rules and ≤ 40 scenarios per HW5 run |
| Model Spec excerpt: license or length | No CC0 line on the page; excerpt over 25 lines | Verify the license line before committing; keep ≤ 25 rule lines; fall back to a public company AI policy with permissive terms, or skip and say so |
| Course key budget exhausted | Cumulative spend near $30 | Stop live runs except the final demo; fixtures for screenshots; report the spend |
| Policy owner cannot meet | No reply by Friday | Email the ambiguity map screenshot or the archived run link with the two questions; a written quote counts |
| Classifier agreement under 80 % | M03 | Up to three prompt revisions evaluated on all three samples; if still under, report the number and the confusion matrix honestly; human kappa gives context |
| Judge agreement under 85 % | M05 | Tighten the rubric wording where disagreements cluster; re-score a fresh sample; report both |
| Decomposer output does not align with hand labels | Eval misses/extras | Report decomposition precision and recall; keep the split/merge UI prominent |
| No real user by Saturday | Candidate silent by Thursday | Classmate fallback; state it plainly; impact section still has M07 and M13 |
| No classmate labels | **Happened 2026-10-21** (classmate in finals) | Kappa not obtained; the ambiguity feature stands on M03, the human–classifier disagreements and the two planted ambiguities (decision record `no-second-labeler`) |
| Fresh-clone run exceeds 10 minutes | Gate 3 | Simplify README steps; remove optional tooling from install; `npm ci`; pre-generate nothing that needs the key |
| Report under 10 or over 15 pages | `report:pages` | Resize figures; move transcripts to an appendix within the limit or cut |
| Numbers in the report drift from the logs | A hand-typed number | Every number comes from `report-data.json`; the build fails on blanks |
| Scope creep into P1 before Gate 1 | Typed-vs-flat or re-run code before the first live run | P1 is Saturday morning at the earliest, after the HW5 bridge; typed-vs-flat first |
| Windows staff machine | Unknown | No shell-specific scripts; `path.join`; `.env` loader tested with Windows paths in unit tests |
| A real key committed by accident | `check-secrets` or `git log -S` | Rotate the key in Portkey, rewrite history before publishing |
| Session context runs long | | `STATUS.md` has a concrete next step per phase so a new session can continue |

---

## 6. Definition of done (P0 acceptance criteria, restated as checks)

- [ ] Paste or upload a policy; three samples load in one click; empty submit shows a message (Req. 1).
- [ ] Decomposer: every rule links to a located span (or is marked unlocated); a 15-rule policy decomposes in under 30 s; outputs are validated JSON (Req. 2).
- [ ] Classifier: type, confidence 0–1, rationale; confidence below 0.7 marks a rule ambiguous; agreement with Shane's labels on Harrow & Vale ≥ 80 %, measured and recorded (Req. 3).
- [ ] Review: type dropdown, split, merge, park; "Run tests" disabled until every rule is confirmed or parked; overrides persist (Req. 4).
- [ ] Collision mapper: up to 3 pairs with a scenario sentence; dismiss works; kept pairs become conflict scenarios (Req. 5).
- [ ] Ladders: 6 ordered rungs per constraint, each a self-contained user turn (Req. 6).
- [ ] Sweeps: 8 points on one stated variable per tradeoff; implied threshold extracted or "not stated" (Req. 7).
- [ ] Executor: gpt-6-luna via Portkey with the policy as system prompt; configurable concurrency; one retry; failed calls recorded as not run; spend cap halts the run with the reason shown (Req. 8).
- [ ] Judge: verdict, verbatim evidence (verified), confidence per transcript; spot-check agreement on 50 transcripts ≥ 85 %, measured (Req. 9).
- [ ] Report: summary strip, one card per rule, a threshold chart per sweep, ambiguity and collision sections, transcript drawer; standalone HTML export; the failing rung or stakes point shown with its transcript (Req. 10).
- [ ] Every model call logs stage, model, input, cached and output tokens; per-run totals in the UI; CSV export; cost from logged counts (Req. 11).
- [ ] Safety: the injected sample is flagged and quarantined (screenshot); a run against a $0.01 cap halts with the reason (screenshot); loop guards configured and documented (Req. 12).
- [ ] Runnable repo: README, `.env.example`, `.env` read from the repo folder then one level up, Portkey default; fresh clone to first report under 10 minutes, measured (Req. 13).
- [ ] Measured targets recorded: 100 % of confirmed rules of all four types have a judged scenario (designed-not-run only if the Gate 1 cut line was taken, and then said so); run time under 3 minutes for the 13-rule policy on the model target; planted-failure scorecard (PRD Success metrics).
- [ ] The ambiguity map renders on the review page and in the report for every sample, including the published policy.
- [ ] An HTTP-agent run against the HW5 backend completed for at least one agent with the known-enforcement table (M20), or the fallback is stated in the report.
- [ ] Cumulative spend on the course key recorded (M21) and under $40.
- [ ] Submission checklist in evidence §7 complete.

---

## 7. If time remains (P1, in order of grade value)

1. **Typed vs flat comparison** (Req. 16): a flat generator, the FLAT rubric, and a comparison table; the single strongest piece of evidence for "what is new". Small: one prompt, one rubric branch, one table.
2. **Re-run and diff** (Req. 17): `rerun` endpoint with a system-prompt override and a verdict diff page.
3. **HW5 run against `boss`**: the orchestrator routes to the whole team, so a third HW5 run shows team-level behavior; slower and costlier than the two specialist runs.
4. **Prompt caching** (Req. 18) is already in the design; the P1 work is only the measurement write-up (M09).

Dispositions and orderings (Req. 14–15) moved into P0 on 2026-10-21; see §2.

Whatever is not built is described in the report's Limits section with its generator prompt shown (PRD mitigation).

---

## 8. File index

| File | Holds |
|---|---|
| [PLAN.md](PLAN.md) | This: order of work, gates, decisions, calendar, risks, done |
| [docs/PRD.md](docs/PRD.md) | The PRD (local copy, synced to Doc rev 26 on 2026-10-21). It governs requirements and acceptance criteria; if the PRD and this plan ever differ again, record the decision and update both |
| [docs/plan/architecture.md](docs/plan/architecture.md) | Stack, layout, env, model access and smoke test, `callModel`, data model, run lifecycle, orchestration, API, UI, export, CLI, tests, security, engineering roadblocks |
| [docs/plan/agents-and-prompts.md](docs/plan/agents-and-prompts.md) | Conventions, each agent's schema, prompt draft, post-processing, mock behavior, tests; aggregation rules |
| [docs/plan/sample-policies.md](docs/plan/sample-policies.md) | The demo policy text, the injected variant, samples 2–3, labels format and protocol, classifier eval, kappa, spot check, timing, real user |
| [docs/plan/evidence-report-slides.md](docs/plan/evidence-report-slides.md) | Evidence inventory, report.html plan, slides, README, `.env.example`, archived run, submission checklist |
