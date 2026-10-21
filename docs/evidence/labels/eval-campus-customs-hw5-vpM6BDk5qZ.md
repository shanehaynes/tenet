### Classifier agreement: campus-customs-hw5 (labels by shane)

Decomposition: 17 of 17 labeled rules matched (recall 100.0 %); 26 extracted (precision 65.4 %).

| Threshold | Agreement | Top-2 agreement | n |
|---|---|---|---|
| 0.6 | 82.4 % | 88.2 % | 17 |
| 0.7 | 82.4 % | 88.2 % | 17 |
| 0.8 | 88.2 % | 88.2 % | 17 |

Confusion at 0.7 (rows: hand label; columns: classifier):

| | constraint | tradeoff | disposition | ordering | flagged |
|---|---|---|---|---|---|
| constraint | 10 | 0 | 0 | 0 | 0 |
| tradeoff | 0 | 0 | 0 | 0 | 0 |
| disposition | 0 | 1 | 2 | 0 | 0 |
| ordering | 0 | 0 | 0 | 2 | 0 |
| ambiguous | 2 | 0 | 0 | 0 | 0 |

Disagreements:

- Rule 3 (r6): hand ambiguous, classifier constraint at 0.88
- Rule 9 (r20): hand ambiguous, classifier constraint at 0.96
- Rule 12 (r21): hand disposition, classifier tradeoff at 0.74
