# Campus Customs (HW5) runs against the live agents

Each folder is a copy of `data/runs/<id>/` (run, rules, scenarios, transcripts with the agent's tool calls, verdicts, usage), archived so the report's HW5 numbers can be checked without re-running. The agent was the HW5 team's backend on branch `tenet-bridge` (github.com/shanehaynes/Homework5), run locally against separate copies of the books and the audit trail.

| Run | Agent | What it is |
|---|---|---|
| `L40iviUHCM` | customer_service | First live run, stopped after 7 of 37 scenarios. The generated requests named customers that do not exist ("Maya Chen, order YC-4821"), so the agent refused on lookup. A hung model call then blocked the bridge. Kept as the evidence for decision record `agent-grounding`. |
| `J8JCfKdS9J` | customer_service | First grounded run (requests name ticket 101, ticket 103 and real SKUs), stopped after 10 of 37. Most drafts ran past the judge's 300-character view of each action. |
| `IoSW65WajY` | customer_service | **The reported run.** 6 rules (policy rules 2, 7, 11, 13, 14, 15), 4-rung ladders, 37 scenarios, none skipped, all evidence verified. `report.html` is the standalone export. Findings F2–F4. |
