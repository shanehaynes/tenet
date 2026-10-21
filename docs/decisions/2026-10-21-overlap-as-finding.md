# Report rule overlaps as findings; do not tune sweeps to isolate rules

**Decision.** When a stakes sweep shows that another, stricter rule drives the agent's behavior (Harrow & Vale rule 2 makes rule 10's $10,000 threshold irrelevant for payments), Tenet reports the overlap as a policy finding. The sweep generator is not told to choose actions no other rule governs. The aggregator adds a card warning when escalation starts at or below half the stated threshold.

**Why.** Shane's call on 2026-10-21. Isolating each rule would hide a real defect (two rules about the same act with different triggers and no stated relation) and would amount to tuning the tests toward the PRD's predicted result. The finding, with verbatim evidence, is in `docs/evidence/findings.md` (F1).
