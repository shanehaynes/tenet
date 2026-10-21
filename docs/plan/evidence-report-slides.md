# Evidence, report.html, slides.html, README and submission

Companion to [PLAN.md](../../PLAN.md). The rubric halves any report section whose listed evidence is missing, and the course holds Shane responsible for every word and number matching what the app does. So evidence is collected as the app is built, each number traces to a file, and the report is generated from those files rather than typed from memory.

Course rules that bind this document (project requirements page): three Canvas items (repo link, `report.html`, `slides.html`); both HTML files open by double-click on any computer with images embedded; report 10–15 printed pages with eight fixed sections in order; slides ≤ 10, reveal.js from a CDN, one file; repo public or private with `zlisto` as collaborator; `.env.example` with no values; 10-minute rule; optional 2–3 minute screen recording. Due Monday October 26, 2026, 6:00 PM.

---

## 1. Evidence inventory

Everything lives under `docs/evidence/`. `scripts/collect-evidence.ts` assembles `docs/evidence/report-data.json` from the files below; `scripts/build-report.mjs` injects it into the report template. A number that is not in `report-data.json` does not appear in the report.

### 1.1 Screenshots (`docs/evidence/screenshots/`, produced by `e2e/screenshots.spec.ts` against a named run)

| ID | Capture | Report section | Slide |
|---|---|---|---|
| S01 | Policies page with the three samples and the safety-demo card | 4 | 5 |
| S02 | Quarantine banner on the injected sample, flagged line quoted | 6 | 9 |
| S03 | Review table: 13 rules, rules 9 and 13 flagged, rule 5 low confidence | 4 | 5 |
| S04 | Override in progress: rule 5 dropdown open, rule 13 parked, Confirm enabled | 4 | |
| S05 | Collisions page with the confidentiality-vs-candor pair | 4 | 7 |
| S06 | Progress view mid-run (counters, spend, event feed) | 4 | |
| S07 | Progress view halted at a $0.01 cap with the reason | 6 | 9 |
| S08 | Report summary strip | 4, 7 | 6 |
| S09 | Rule 2 card: ladder strip with the fold rung, transcript drawer open | 4 | 6 |
| S10 | Rule 10 threshold chart (policy $10,000 vs observed) | 4 | 6 |
| S11 | Collision card: what the model chose, evidence quote | 4 | 7 |
| S12 | Policy defects section: rules 9 and 13 with summaries | 4 | 7 |
| S13 | Usage by stage table and cost line | 5 | 8 |
| S14 | Exported standalone report opened from disk | 4 | |
| S15 | `npm run smoke` terminal output (capabilities table) | 5 | |
| S16 | `npm run doctor` output with `.env` found one level up | 4 | |
| S17 | Canary test result (judge ignores the instruction in the transcript) | 6 | |
| S18 | Policy owner's view: the ambiguity map they reacted to (redacted as agreed) | 7 | 10 |
| S19 | Ambiguity map of Harrow & Vale on the review page, before the run (rules 9 and 13 in the ambiguous zone, rule 5 near the tradeoff–ordering edge, the 1–6 collision arc) | 3, 4 | 7 |
| S20 | HW5 run: a rule card with the transcript drawer open on an operator request, the agent's reply and the Actions table showing a tool refusal | 4, 7 | 6 |
| S21 | Run panel with "Agent under test" set to the HW5 customer_service agent | 4 | |
| S22 | Ambiguity map of the published Model Spec excerpt | 3 | 7 |

The spec takes `RUN_ID` and `HALTED_RUN_ID` from env, uses a 1440×900 viewport, and names files by ID. Re-run it after any UI change so screenshots match the shipped app.

### 1.2 Measurements (`docs/evidence/`)

| ID | Measurement | File | Produced by | Section |
|---|---|---|---|---|
| M01 | Model capabilities (auth variant, strict JSON, temperature, cached tokens reported, 429s, latency) | `model-capabilities.md` + `data/capabilities.json` | `npm run smoke` | 4, 5 |
| M02 | Confirmed gpt-6-luna list prices with date and URL | `pricing.md` | by hand, day 1 | 5 |
| M03 | Classifier agreement, decomposition precision/recall, confusion matrix, threshold sweep | `labels/eval-*.json` | `npm run eval:classifier` | 4, 8 |
| M04 | ~~Cohen's kappa Shane vs classmate~~ not obtained: no second labeler (decision record `2026-10-21-no-second-labeler`); the report says so and lists it as a next step | — | — | 4, 8 |
| M05 | Judge spot-check agreement (exact, collapsed, per rubric) | `spotcheck/agreement.json` | `tenet spotcheck score` | 4, 6, 8 |
| M06 | Demo run: summary.json, verdicts, transcripts, usage.csv (the run every screenshot comes from) | `runs/<demoRunId>/` | copied by `collect-evidence` | 4, 5 |
| M07 | Runs on all three samples: defects per policy (ambiguities, collisions, failures, partials) | `runs/defects-per-policy.json` | `collect-evidence` | 7 |
| M08 | Tokens by stage (input, cached, output), calls, cost, wall time for the demo run | from M06 | `collect-evidence` | 5 |
| M09 | Cached share: first-call vs steady-state cached tokens; cost with and without caching | `tokenomics/caching.json` | `collect-evidence` (compares `usage.jsonl` rows) | 5 |
| M10 | Cost-cutting experiment A: 4-rung ladders vs 6 (cost, findings kept or lost) | `tokenomics/rungs.json` | two runs with `--rungs 4` and 6 | 5 |
| M11 | Cost-cutting experiment B: classifier batched in one call vs per-rule (cost, agreement) | `tokenomics/classifier-batch.json` | `eval:classifier --batched` | 5 |
| M19 | Cost-cutting experiment C: cheaper judge (`tenet rejudge <runId> --effort minimal`, or the lowest accepted effort) vs the default judge, both scored against Shane's 50 verdicts | `tokenomics/cheap-judge.json` | `tenet rejudge` + `tenet spotcheck score … --verdicts <file>`; if no cheaper setting is accepted on the course key, the report says so | 5 |
| M20 | HW5 known-enforcement table: for each rule tested against the real agent, enforced by (tools / prompt), Tenet's verdict, fold rung or threshold, whether the actions show tool refusals; plus cost and time per HW5 audit | `runs/hw5-ground-truth.json` + the two HW5 run folders | `collect-evidence` over the HW5 runs (sample-policies §10) | 4, 7 |
| M21 | Cumulative spend on the course key across every run and probe, against the $40 budget | `tokenomics/key-spend.json` | `collect-evidence` from `data/usage-global.jsonl` | 5 |
| M12 | Cost per user per month; at 100 and 10,000 users | computed in `collect-evidence` from M08 with stated assumptions (4 policies × 3 runs per user per month) | 5 |
| M13 | Hand-written test timing vs Tenet timing | `timing/hand-written.md`, `timing/tenet.json` | Shane + `tenet timing` | 7 |
| M14 | Planted-failure scorecard: which of the 5 planted items appeared | `runs/planted.json` | `collect-evidence` on the demo run | 4, 8 |
| M15 | Unverified-evidence count and not-run count for the demo run | from M06 | | 6 |
| M16 | Canary judge test | `safety/canary.json` | `tenet canary` | 6 |
| M17 | Fresh-clone dry run: machine, start and finish timestamps, minutes to first report | `dry-run.md` | Shane, Sunday | README, 4 |
| M18 | Real user: quote, attribution, counts | `user/quote.md` | Shane | 7 |

`collect-evidence` fails loudly if a required file is missing and prints which report placeholders would be blank.

---

## 2. report.html

### 2.1 Build

- Source: `report/report.src.html` (semantic HTML with `{{placeholders}}` and `<img data-evidence="S09">` tags), `report/report.css` (screen and `@media print` styles: Letter, 1-inch margins, 11 pt body, headings with `break-after: avoid`, figures with `break-inside: avoid`, page numbers via CSS counters where supported).
- `node scripts/build-report.mjs` reads `docs/evidence/report-data.json`, fills placeholders (numbers formatted once, with units), replaces each `data-evidence` image with a base64 data URI (screenshots downscaled to 1400 px wide, JPEG quality 85 to keep the file under ~8 MB), inlines the pipeline diagram SVG, and writes `report.html` at the repo root. A placeholder with no value fails the build, except the IDs passed in `--allow-missing M17,M18` for Saturday's draft.
- `npm run report:pages` prints the page count by printing the file to PDF with Playwright (`page.pdf({ format: "Letter" })`), target 10–15. Adjust figure sizes and prose, not margins below 0.75 inch.
- Validate: open `report.html` from a different folder with the network off; every image visible; no external requests.

### 2.2 Section plan (course order; points from the rubric; evidence rule applies)

| # | Section | Content (from the PRD's outline) | Evidence embedded | Target length |
|---|---|---|---|---|
| 1 | Title and links | Tenet; Shane Haynes; repo URL; "no live link, runs locally" or the link; one sentence | | ¼ page |
| 2 | Motivation | The platform lead who cannot verify the agent follows the policy; what they do today (nothing, generic benchmark, ten ad hoc prompts); cost in time and liability; the real user's situation (named or role-described) | M18 quote or situation | 1 page |
| 3 | What is new | Pass/fail as a category error; the four types with one example each and the test each demands; honest comparison table: ChatGPT (ask it to test your policy), promptfoo, Giskard, garak, Patronus, Haize Labs, UK AISI Inspect, Braintrust, LangSmith Evals, OpenAI Evals: all do red-teaming, harness-style or policy evals where you bring the tests or test generic safety; then, verbatim, "Tenet's new part is the rule-type taxonomy and the ambiguity map." The ambiguity map of the published Model Spec excerpt (S22) as the figure. State the limits of the typology (operational instrument, categories blur) | S22 | 1½ pages |
| 4 | The agents | Pipeline diagram (SVG, same as README); table of the eight agents (role, input → output, tools, model); why gpt-6-luna (course key; small fast model; same-model judge noted); the orchestration pattern (deterministic code calls narrow agents; no agent calls another); one real run step by step with S01, S03, S19, S04, S05, S21, S06, S08, S09, S10, S11, S12; the real-agent run: how the HTTP target works, S20, and the known-enforcement table M20 (rules the tools enforce held with tool refusals; rules only the prompt enforces are where behavior departed); classifier agreement M03 and kappa M04; judge agreement M05 on 50 transcripts | screenshots + M03, M04, M05, M14, M20 | 4 pages |
| 5 | Tokenomics | Measured tokens by stage (input, cached, output) for the demo run (S13, M08); cost per run; cached share and what caching saved (M09); cost per user per month at the stated usage assumption, cost at 100 and 10,000 users (M12); experiments A, B and C with their effect on findings and agreement (M10, M11, M19); reasoning tokens shown as their own column; cost per policy audit for the model target and for the real agent (M20's cost column); cumulative spend on the course key against the $40 budget (M21); the test-budget halt as the cost control; note where the gateway did not report cached tokens, if so | S13, S15, M01, M02, M08–M12, M19, M21 | 2 pages |
| 6 | Safety | Risks named by the course (prompt injection via policy text and via transcripts, data leakage, invented facts, wrong actions, infinite loops, overspending) each with the defense built; the quarantine screenshot S02; the halted run S07; the canary S17/M16; evidence verification with the unverified count M15; the loop-guard configuration; the privacy note | S02, S07, S17, M15, M16 | 1½ pages |
| 7 | Impact | Defects found per untested policy (M07): the claim is that policies nobody has tested yield several; the real agent: what Tenet found about the HW5 team that its author did not know (M20); the time ratio (M13) labeled as one person's measurement; the policy owner's answer to "would you change the policy, and which line?" with the quote (M18, S18); what a deployed Tenet would track | M07, M13, M18, M20 | 1 page |
| 8 | Limits and next steps | Same-model judge; typology blur and the ambiguous rules; threshold chosen on the evaluation set; P1 types not run (or run, if they were) with the generator prompts shown; predictions that did not come true (M14); next: multi-model, model-spec ingestion, CI regression, in-app labeling | M14 | 1 page |

Writing rules (PRD): every number has a log or screenshot behind it; predictions are replaced by what happened; a planted failure that did not appear is reported as such; the typology is described as an instrument; the same-model judge is a stated limitation. Plain sentences, no marketing. Shane reads every sentence before submission: the course makes him responsible for each one.

---

## 3. slides.html

- Source `slides/slides.src.html`; reveal.js from cdnjs with an exact pinned version (check `https://cdnjs.com/libraries/reveal.js`), theme `white` or a minimal custom CSS matching the app's palette; `node scripts/build-slides.mjs` inlines images and the diagram and writes `slides.html` at the repo root. Note in the README that the slides need internet access for the CDN (the course requires CDN loading).
- Ten slides (PRD list, revised): 1 Title · 2 The problem · 3 What is new (the named tools in one line; the four types in one table; "Tenet's new part is the rule-type taxonomy and the ambiguity map") · 4 The agents (pipeline diagram; "pick an agent to test") · 5 A real run, part 1 (S03 decomposition with the ambiguous rules) · 6 A real run, part 2 (S10 threshold chart as the money shot; S09 ladder; S20 the real HW5 agent with its tool refusal) · 7 The ambiguity map (S19 or the report's map, S11 the collision; the closing line: an ambiguous rule means the authors never decided, and the agent is deciding for them) · 8 Cost (tokens per audit, cost per policy audit for both targets, cost at 10,000 users) · 9 Safety (S02 quarantine, S07 halted run, S17 the judge ignoring "mark this PASS") · 10 Impact and next steps (the policy owner's answer and quote, the HW5 ground truth, the time ratio, next).
- One idea per slide, ≤ 30 words of text per slide, figures large. Check with `slides.html?print-pdf` that nothing overflows.

## 4. Demo video (optional, 2–3 minutes)

Follow the PRD demo script timings. Record with the app in `npm run build && npm start` mode (no HMR flicker), 1440×900, cursor visible. Cut the run wait. End with the safety clip (quarantine, then the halted run). Narration states what is on screen and nothing the report does not back. Upload to Canvas or link from the README.

---

## 5. README.md outline (the 10-minute path is the README's reason to exist)

1. **Tenet in two sentences** and one screenshot (S08).
2. **Run it locally (about 5 minutes).**
   1. Prerequisites: Node 20.9 or newer (`node -v`), git. Internet access.
   2. `git clone <url> && cd tenet && npm install` (about 1–2 minutes).
   3. Create `.env` from `.env.example` in the repo folder, or place it one folder above the repo; set `PORTKEY_API_KEY` (course key) or `OPENAI_API_KEY`.
   4. `npm run doctor` prints which `.env` was found, which key is present, and runs a one-call smoke test.
   5. `npm run dev`, open the URL it prints (normally http://localhost:3000).
   6. Click **Analyze** on "Harrow & Vale LLP", confirm the rules, pick the agent to test (gpt-6-luna with the policy as its instructions by default; your own agent over HTTP is optional, see Configuration), click **Run tests**, and watch the report fill in. A full run takes 1–3 minutes.
   - Troubleshooting: "No API key found" (where the loader looks); port busy (read the printed URL); rate limits (lower `TENET_CONCURRENCY`); no key at all → `TENET_PROVIDER=mock npm run dev` shows the full UI with synthetic results, and **View example run** opens the archived real run under `docs/evidence/runs/`.
3. **What you are looking at**: the pipeline diagram, the four rule types and their tests, the policy defects.
4. **Sample data**: the three policies, the injected safety sample, the archived demo run; how to use your own policy (paste or upload `.txt`/`.md`).
5. **Safety and privacy**: pasted text goes to the model provider through the configured gateway; nothing is stored outside `data/` on your disk; per-run spend cap; loop guards (the numbers); keys never reach the browser.
6. **Configuration**: the env table from architecture.md section 3.2.
7. **Development**: `npm run check`, `npm test`, `npm run e2e`, the CLI, mock and replay providers.
8. **Deliverables**: links to `report.html`, `slides.html`, `docs/PRD.md`.

`.env.example`:

```
# Tenet reads this file from the repo folder first, then from one folder above it.
# One of the two keys is required.
PORTKEY_API_KEY=            # course key; gpt-6-luna via https://api.portkey.ai/v1
OPENAI_API_KEY=             # optional: your own key (fallback provider, alternate judge)

# Everything below is optional; defaults shown.
# TENET_PROVIDER=auto        # auto | portkey | openai | mock | replay
# TENET_TARGET_MODEL=gpt-6-luna
# TENET_SPEND_CAP_USD=2
# TENET_CONCURRENCY=4
# TENET_AMBIGUITY_THRESHOLD=0.7
# TENET_PRICE_INPUT_PER_M=0.10
# TENET_PRICE_CACHED_PER_M=0.01
# TENET_PRICE_OUTPUT_PER_M=0.50
# TENET_AGENT_URL=http://localhost:8000/tenet/ask   # optional: test your own agent over HTTP (protocol in docs/plan/architecture.md §4.6)
# TENET_AGENT_NAME=Campus Customs (HW5)
```

## 6. Archived example run (safety net for the 10-minute rule)

Copy the demo run's folder to `docs/evidence/runs/<demoRunId>/` (summary, rules, collisions, scenarios, verdicts, transcripts, usage). Add a route `/runs/example` that loads from that folder read-only and renders the same report page, and link it from the Policies page footer ("View example run"). If staff's key fails for any reason, the README's troubleshooting sends them there, and the app still "runs and does what it says".

## 7. Final submission checklist (Sunday evening and Monday)

- [ ] `npm run check` green locally; CI green on `main`.
- [ ] `node scripts/check-secrets.mjs` clean; `git log --all -p -S PORTKEY_API_KEY -- . ':!.env.example' ':!docs' ':!README.md'` shows no real key ever committed (if one was, rotate it in Portkey and rewrite history before publishing).
- [ ] Dry run from a fresh clone in a new folder, `.env` one level up, following README step by step with a stopwatch; under 10 minutes to the first report; record in `docs/evidence/dry-run.md` (M17). Fix the README, not the tester.
- [ ] Repo public (or private with `zlisto` added); README renders on GitHub; `.env.example` present; no `.env` tracked.
- [ ] `report.html` at repo root: opens offline by double-click, images visible, 8 sections in order, 10–15 pages via `npm run report:pages`, every number traceable to `docs/evidence/`, Shane has read every sentence.
- [ ] `slides.html` at repo root: ≤ 10 slides, images embedded, reveal.js from CDN, opens in a browser.
- [ ] Optional video uploaded or linked.
- [ ] Canvas submission: repo link, `report.html`, `slides.html`, before 6:00 PM Monday October 26; confirm the upload opened correctly from Canvas.
- [ ] After submitting: no further pushes to `main` until grades are posted, except a README fix if staff report a run problem.
