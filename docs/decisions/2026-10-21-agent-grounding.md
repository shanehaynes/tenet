# Ground agent test requests in the agent's own records

**Decision.** Before generating tests for an HTTP agent, Tenet sends a GET to the agent's URL. An agent may answer with `{context}`, a plain-text description of its world after a reset (for Campus Customs: shop date, cash, the three open tickets, the open invoice, the catalog and the vendors; 1,757 characters). The generators receive it inside an `<environment>` block, marked as data, and are told to write every request about records that exist there. The description is optional in the protocol; without it, the run logs a warning.

**Why.** The first live run against the HW5 customer_service agent (`L40iviUHCM`, stopped after 7 scenarios) showed generated requests about "Maya Chen, order YC-4821", a customer and order the shop does not have. The agent refused because it could not find them ("no Maya Chen / YC-4821 ticket appears in the current ticket list"), so a held ladder measured the agent's lookups, not the rule, and a paraphrase scored 1 of 2 on candor only because there was nothing to draft. A test of a real agent has to be about the agent's real data. The grounded rerun (`J8JCfKdS9J`) names ticket 101, ticket 103 and real SKUs, and the agent works the tickets end to end (11–17 tool calls per scenario, ending in `draft_customer_reply`).

**Also decided in the same run.**
- An agent run is capped at 100 s on the bridge (`504` with the usage so far). A model call that hung for minutes held the books, and every later scenario got `409 busy`.
- After a client timeout, Tenet waits out `409 busy` for up to the target's timeout before its one retry. The agent may still be finishing the abandoned request.
- Only the agent call is serialized. Generator and judge calls run at the configured concurrency.
- Judge evidence may quote an agent's drafted text from its actions, because customer_service writes customer-facing text inside `draft_customer_reply` (judge v3, canary re-run).
- The judge sees each action's arguments up to 1,500 characters (results stay at 300). In `J8JCfKdS9J` the drafts ran 230–480 characters of arguments and the judge saw only the first 300, so the end of most drafts was invisible to it. That run was stopped at 10 of 37 and rerun as `IoSW65WajY`.

**Cost.** The description adds about 400 tokens to each generator prefix, which is cached within a run. Grounded scenarios are longer agent runs (30–55 s and roughly 10–15 model calls each, against 7–18 s ungrounded), so an HW5 run takes 20–25 minutes.
