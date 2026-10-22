# Ask the gateway for a fresh answer on every call

**Decision.** Every Portkey call Tenet makes sends `x-portkey-cache-force-refresh: true`, and every usage event records the gateway's `x-portkey-cache-status` (`hit`, `miss`, `refresh`). `TENET_GATEWAY_CACHE=allow` turns the refresh off, for cheap demo replays only. The HW5 bridge does the same for the agents' own calls when started with `CAMPUS_FRESH_MODEL_CALLS=1`.

**Why.** On 2026-10-21 a test–retest of the judge (the same transcripts judged twice with the same settings) agreed 37/37 and 36/36, at a median of 182 ms per call against about 2 s. The gateway replays identical requests from a response cache. The cache is written asynchronously, so an immediate repeat can miss while a repeat a minute later hits (`docs/evidence/tokenomics/gateway-cache.md`). A testing tool cannot let that happen: a re-run must measure the agent again, not replay it.

**What it affected, found by latency (a fresh call takes 1.5–3 s; a replay 0.1–0.4 s with output tokens identical to an earlier call):**

| Evidence | Effect | Action |
|---|---|---|
| Archived demo run `87VQK7KAKg` (example run, screenshots, M06, M08, M09, M12) | 63 of 64 executor and 62 of 64 judge calls replayed from `28Cv5g6wi1`. Its verdicts are that run's verdicts, and its 7.8 s "test time" is not real. Tokens and cost are reported as the original calls used them, so cost per run stands as a per-run cost. | Replaced on 2026-10-22 by the fresh run `449NHijnXq` (the example run, screenshots S01–S14 and S19). Do not cite `87VQK7KAKg`'s wall-clock time. |
| `28Cv5g6wi1` (F1) | The rule-2 ladder was replayed from `CytBFyz339`. The rule-10 sweep behind F1 was fresh. | F1 stands. "Rule 2 held in both runs" is corrected to one observation. |
| Canary "v2, repeated twice" | Both repeats were replays. | Withdrawn. Three fresh runs pass (`safety/canary-log.md`). |
| HW5 customer_service `IoSW65WajY` | The generator calls replayed the stopped run `J8JCfKdS9J`, so the scenarios are the same; the agent's first scenarios were replays of that run's agent calls. The judge was fresh. | Kept: each scenario is still one real agent response, judged fresh. Not counted as independent of `J8JCfKdS9J`. |
| HW5 accounting `kadE9UGsFP`, scope rerun `S0p9QWq0Pa` | Fresh, apart from analysis calls (the same policy text, so the same rules). | None. |
| First judge test–retest, and the first in-place re-judge | Partly replayed. | Deleted and redone fresh: the re-judges are logged `refresh`. Test–retest agreement is 73/79 (92.4 %) across the three HW5 runs. |

**Cost.** Refresh bills every call. Replays were probably not billed by the provider, but the ledger counted them anyway, so the key budget was overstated, never understated.

**Also hidden: decomposer variation (found 2026-10-22).** Every earlier Harrow & Vale run got the same 13-rule decomposition, because one decomposer answer was replayed. The two fresh runs on 2026-10-22 split the policy into 16 rules (`vTaQ8Ffr36`, which also extracted the Scope section's sentences) and 14 (`449NHijnXq`). The screenshot script picked the demo's overrides by rule number, so in `vTaQ8Ffr36` it parked the $10,000 rule. It now finds rules by their words. That run and its halted twin `y1UI7zSAdR` are not used.
