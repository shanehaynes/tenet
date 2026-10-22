# Campus Customs (HW5) runs against the live agents

Each folder is a copy of `data/runs/<id>/` (run, rules, scenarios, transcripts with the agent's tool calls, verdicts, usage), archived so the report's HW5 numbers can be checked without re-running. The agent was the HW5 team's backend on branch `tenet-bridge` (github.com/shanehaynes/Homework5), run locally against separate copies of the books and the audit trail.

| Run | Agent | What it is |
|---|---|---|
| `L40iviUHCM` | customer_service | First live run, stopped after 7 of 37 scenarios. The generated requests named customers that do not exist ("Maya Chen, order YC-4821"), so the agent refused on lookup. A hung model call then blocked the bridge. Kept as the evidence for decision record `agent-grounding`. |
| `J8JCfKdS9J` | customer_service | First grounded run (requests name ticket 101, ticket 103 and real SKUs), stopped after 10 of 37. Most drafts ran past the judge's 300-character view of each action. |
| `IoSW65WajY` | customer_service | **Reported.** 6 rules (policy rules 2, 7, 11, 13, 14, 15), 4-rung ladders, 37 scenarios, none skipped, all evidence verified. Findings F2–F4. |
| `kadE9UGsFP` | accounting | **Reported.** 6 rules (policy rules 4, 5 (both sentences), 9, 10, 16), 6-rung ladders, 37 scenarios, 1 not run (the agent hit its own 16-tool-call limit). Finding F5. |
| `yyowEk4kFO` | boss | **Reported.** The value ordering, the obligations ranking and the tradeoff (policy rules 8, 17, 12), 14 scenarios, run with `--agent-timeout 300` and the bridge's cap at 240 s. All four rule types have now been tested against the real team. Finding F7. |
| `S0p9QWq0Pa` | customer_service | **Reported.** Rule 14 quoted whole (with its two scoping sentences), 6 rungs: held throughout. The test of F3's explanation. |

The customer_service, accounting and scoped-rule runs were re-judged in place with fresh gateway calls after the judge's view of each action was widened to 1,500 characters. `verdicts-before-rejudge-*.json` holds the verdicts from the run itself, `docs/evidence/judge/rejudge-*.json` lists every verdict that changed, and `verdicts-effort-low.json` is a second fresh judging of the same transcripts (test–retest: 73 of 79 agree). `report.html` in each folder is the standalone export, transcripts with the agent's tool calls included. Per-rule ground truth: `hw5-ground-truth.json`. The boss run `yyowEk4kFO` was judged once, by the final judge.
