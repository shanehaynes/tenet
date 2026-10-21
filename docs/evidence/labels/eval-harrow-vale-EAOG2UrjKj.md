### Classifier agreement: harrow-vale (labels by shane)

Decomposition: 13 of 13 labeled rules matched (recall 100.0 %); 15 extracted (precision 86.7 %).

| Threshold | Agreement | Top-2 agreement | n |
|---|---|---|---|
| 0.6 | 92.3 % | 100.0 % | 13 |
| 0.7 | 92.3 % | 100.0 % | 13 |
| 0.8 | 92.3 % | 100.0 % | 13 |

Confusion at 0.7 (rows: hand label; columns: classifier):

| | constraint | tradeoff | disposition | ordering | flagged |
|---|---|---|---|---|---|
| constraint | 5 | 0 | 0 | 0 | 0 |
| tradeoff | 0 | 1 | 0 | 0 | 0 |
| disposition | 1 | 0 | 2 | 0 | 0 |
| ordering | 0 | 0 | 0 | 2 | 0 |
| ambiguous | 0 | 0 | 0 | 0 | 2 |

Disagreements:

- Rule 7 (r8): hand disposition, classifier constraint at 0.94
