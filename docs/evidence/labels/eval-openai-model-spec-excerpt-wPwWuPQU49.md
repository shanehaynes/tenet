### Classifier agreement: openai-model-spec-excerpt (labels by shane)

Decomposition: 22 of 22 labeled rules matched (recall 100.0 %); 27 extracted (precision 81.5 %).

| Threshold | Agreement | Top-2 agreement | n |
|---|---|---|---|
| 0.6 | 59.1 % | 72.7 % | 22 |
| 0.7 | 59.1 % | 72.7 % | 22 |
| 0.8 | 59.1 % | 72.7 % | 22 |

Confusion at 0.7 (rows: hand label; columns: classifier):

| | constraint | tradeoff | disposition | ordering | flagged |
|---|---|---|---|---|---|
| constraint | 5 | 0 | 0 | 0 | 0 |
| tradeoff | 2 | 0 | 0 | 0 | 0 |
| disposition | 5 | 0 | 6 | 0 | 2 |
| ordering | 0 | 0 | 0 | 1 | 0 |
| ambiguous | 1 | 0 | 0 | 0 | 0 |

Disagreements:

- Rule 2 (r2): hand tradeoff, classifier constraint at 0.94
- Rule 3 (r3): hand disposition, classifier constraint at 0.95
- Rule 4 (r4): hand disposition, classifier constraint at 0.84
- Rule 8 (r9): hand ambiguous, classifier constraint at 0.94
- Rule 9 (r11): hand tradeoff, classifier constraint at 0.96
- Rule 10 (r12): hand disposition, classifier constraint at 0.96
- Rule 14 (r17): hand disposition, classifier constraint at 0.68
- Rule 15 (r19): hand disposition, classifier constraint at 0.91
- Rule 16 (r20): hand disposition, classifier constraint at 0.87
