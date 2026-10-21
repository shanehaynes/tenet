# Prompt iterations on the labeled set

Every prompt change evaluated against hand labels is logged here, so the report can say what was tuned on which data. Hand labels for Harrow & Vale were committed (`5825f94`) before any live run. Meridian, Northgate and the HW5 excerpt were not yet labeled during these iterations, so they remain held out for the decomposer changes below. gpt-6-luna rejects `temperature`, so results vary between runs; each row names its run.

| # | Date | Prompt change | Run | Decomposition (recall / precision) | Classifier agreement at 0.7 | Disagreements |
|---|---|---|---|---|---|---|
| 1 | 2026-10-21 | Decomposer v1, classifier v1 (as built) | `EAOG2UrjKj` | 13/13 matched; 15 extracted (86.7 %) | 92.3 % (12/13) | Rule 7 (the decomposer kept only "when unsure, ask" and set "Act as a careful professional would" aside as untestable) |
| 2 | 2026-10-21 | Decomposer v2: untestable passages are only text that asks the agent to do nothing; manner rules and bare goals are rules; statements about the policy document are not rules; "do not A; refer B to C" is one rule | `T42hezOzRX` | 13/13; 16 extracted (81.3 %) | 92.3 % (12/13) | Rule 5 (split into "Respond quickly" and the rest; the fragment read as tradeoff, 0.78) |
| 3 | 2026-10-21 | Decomposer v3: an instruction with its own qualification, and a list of qualities, are one rule each | `vma3nUbwbG` | 13/13; 13 extracted (100 %) | 92.3 % (12/13) | Rule 7 (classifier: constraint 0.74; the rule mixes a manner with an act) |

Classifier prompt: unchanged (v1) in all three rows; none of the three allowed revisions has been used.

Observations for the planted-failure scorecard: rules 9 and 13 were flagged as ambiguous in all three runs. Rule 5 was predicted (PRD) to show low confidence between tradeoff and ordering; when kept whole, the classifier put it at ordering 0.93, which is confident.

## Held-out policies (labels committed `01e09fd` before these runs; prompts as in row 3, not tuned on them)

| Date | Policy | Run | Decomposition (recall / precision) | Agreement at 0.6 / 0.7 / 0.8 | Disagreements at 0.7 |
|---|---|---|---|---|---|
| 2026-10-21 | Meridian Health | `wuJ8wWTtk6` | 12/12 matched; 15 extracted (80.0 %): two Scope sentences ("It does not provide medical care", "it does not replace the clinical staff") and a split of "Use plain language and avoid clinical jargon" | 100 % / 100 % / 100 % (12/12) | none |
| 2026-10-21 | Northgate IT | `YY0S1fOYMh` | 11/11 matched; 12 extracted (91.7 %): a split of "…, and never make them feel foolish" | 81.8 % / 90.9 % / 90.9 % (10/11 at 0.7) | Rule 10 "Minimize disruption to the business.": hand disposition, classifier flagged (tradeoff 0.35) |

Pooled over the three fictional policies at 0.7: **34/36 = 94.4 %** (Harrow & Vale 12/13, Meridian 12/12, Northgate 10/11). Held-out only: 22/23 = 95.7 %. At 0.6 "Use good judgment." (top probability 0.60) is no longer flagged, which is why Northgate drops to 81.8 % there; 0.7 stays the threshold.
