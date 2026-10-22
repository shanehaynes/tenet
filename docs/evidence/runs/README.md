# Archived runs

Copies of `data/runs/<id>/` (run, rules, scenarios, transcripts, verdicts, usage), so every cited number can be checked without a model. `report.html` in a folder is that run's standalone export. Per-run details: `HW5-RUNS.md` for the HW5 agent team.

| Run | Policy | Status | Used for |
|---|---|---|---|
| `449NHijnXq` | Harrow & Vale | **Current example run** (`example.json`), fresh calls | Screenshots S01–S14 and S19; M06, M08, M09, M12, M14, M15; the blind spot check (M05); the cheaper-judge re-judge (M19); timing (M13) |
| `ySmxtWrMwE` | Harrow & Vale | Current | The run halted by a $0.01 test budget (S07) |
| `87VQK7KAKg` | Harrow & Vale | **Superseded** 2026-10-22: largely replayed by the gateway's response cache (decision record `gateway-cache`) | Do not cite |
| `28Cv5g6wi1` | Harrow & Vale | Partly replayed; its rule-10 sweep was fresh | Finding F1 |
| `CytBFyz339` | Harrow & Vale | First live run | The sweep-generator change in `prompt-changes.md` |
| `6en5fEzxaf`, `SAnnfrbsRa` | Harrow & Vale | Current | M10: 4 rungs against 6 |
| `JLX9iZjgpG`, `vn3jLywoMW`, `7J1pfQjoOJ`, `8N57mBlbay` | Meridian, Northgate, Model Spec excerpt, mission statement | Current | M07 (finding F6); S22 is from `7J1pfQjoOJ` |
| `IoSW65WajY`, `kadE9UGsFP`, `S0p9QWq0Pa`, `yyowEk4kFO` | Campus Customs (HW5), real agents | Current | M20 (findings F2–F5, F7); S20 |
| `L40iviUHCM`, `J8JCfKdS9J` | Campus Customs (HW5) | Stopped early, kept as evidence | Decision record `agent-grounding` |

The cumulative usage log behind M21 is under the git-ignored `data/`; a snapshot from 2026-10-22 is `../tokenomics/usage-global-2026-10-22.jsonl`.
