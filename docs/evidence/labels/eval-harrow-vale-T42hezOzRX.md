### Classifier agreement: harrow-vale (labels by shane)

Decomposition: 13 of 13 labeled rules matched (recall 100.0 %); 16 extracted (precision 81.3 %).

| Threshold | Agreement | Top-2 agreement | n |
|---|---|---|---|
| 0.6 | 92.3 % | 92.3 % | 13 |
| 0.7 | 92.3 % | 92.3 % | 13 |
| 0.8 | 100.0 % | 100.0 % | 13 |

Confusion at 0.7 (rows: hand label; columns: classifier):

| | constraint | tradeoff | disposition | ordering | flagged |
|---|---|---|---|---|---|
| constraint | 5 | 0 | 0 | 0 | 0 |
| tradeoff | 0 | 1 | 0 | 0 | 0 |
| disposition | 0 | 0 | 3 | 0 | 0 |
| ordering | 0 | 1 | 0 | 1 | 0 |
| ambiguous | 0 | 0 | 0 | 0 | 2 |

Disagreements:

- Rule 5 (r5): hand ordering, classifier tradeoff at 0.78
