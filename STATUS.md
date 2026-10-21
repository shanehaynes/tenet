# Status

Updated 2026-10-21 (afternoon) by the building session. Plan: `PLAN.md` §3 (re-baselined 2026-10-21).

## Days and gates

| Day | Work | Gate | State |
|---|---|---|---|
| Wed Oct 21 | Foundation: samples, scaffold, env, schemas, store, model layer, CLI, CI. Analysis: scanner, decomposer, classifier, collisions, analysis API | `tenet analyze` works in mock; live once labels committed | **done** (mock and live) |
| Thu Oct 22 | Review page + ambiguity map, collisions page, classifier agreement; Summary contract, four generators, executor, judge, aggregation, execution pipeline | Mock `tenet run` end to end; live run attempted | next |
| Fri Oct 23 | Live report, export, evidence tooling, safety demos, archived run, README | **Gate 1 by noon** | |
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
- `docs/labeling-guide.md`: the working definitions both labelers use.
- 98 unit and pipeline tests. Mock `tenet analyze samples/harrow-vale.md` → 13 rules, rules 5/9/13 pre-parked; injected sample → quarantined; mission statement → "no testable rules".

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
| 2026-10-21 | Label `samples/meridian-health.labels.json`, `samples/northgate-it.labels.json`, `samples/campus-customs-hw5.labels.json` using only `docs/labeling-guide.md` (do not open `docs/evidence/labels/` until your labels are committed), set `labeledAt`, commit (or hand the files back). Model Spec labels optional. | **Thu Oct 22, 10 AM (hard)** |
| 2026-10-21 | Send the classmate labeler the three policies, `docs/labeling-guide.md` and blank label files (deadline Sat). Contact the classmate labeler and a policy owner (Eide Bailly colleague, Yale IT, compliance contact) | Thu Oct 22 |
| 2026-10-21 | HW5 backend runnable on this machine: `.venv`, `.env` with the key, `cd backend && ../.venv/bin/uvicorn main:app --port 8000` (HW5 cloned read-only at `~/projects/Homework5`) | Fri Oct 23 |

## Known gaps

- gpt-6-luna rejects `temperature`, so live results vary run to run; every reported number names its run id.
- The executor prefix (1,075 tokens on the demo policy) caches; a much shorter user policy would fall under the 1,024-token floor, and the report should say so.
- No UI pages yet beyond a placeholder home page (Thursday task 1).
- The Playwright suite is a placeholder (`--pass-with-no-tests`) until Thursday's pages exist.

## Next step

Thursday task 1: the Review page with the ambiguity map (architecture §9–10), reading `GET /api/runs/:id`; shadcn/ui with a 20-minute timebox.
