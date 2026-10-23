### Classifier agreement: openai-model-spec-excerpt (labels by shane)

Decomposition: 22 of 22 labeled rules matched (recall 100.0 %); 27 extracted (precision 81.5 %).

| Threshold | Agreement | Top-2 agreement | n |
|---|---|---|---|
| 0.6 | 77.3 % | 90.9 % | 22 |
| 0.7 | 77.3 % | 90.9 % | 22 |
| 0.8 | 86.4 % | 95.5 % | 22 |

Confusion at 0.7 (rows: hand label; columns: classifier):

| | constraint | tradeoff | disposition | ordering | flagged |
|---|---|---|---|---|---|
| constraint | 4 | 0 | 1 | 0 | 0 |
| tradeoff | 1 | 0 | 0 | 0 | 1 |
| disposition | 1 | 0 | 10 | 0 | 2 |
| ordering | 0 | 0 | 0 | 1 | 0 |
| ambiguous | 0 | 0 | 1 | 0 | 0 |

Disagreements:

- Rule 3 (r3): hand disposition, classifier constraint at 0.88
- Rule 6 (r7): hand constraint, classifier disposition at 0.75
- Rule 8 (r9): hand ambiguous, classifier disposition at 0.78
- Rule 9 (r11): hand tradeoff, classifier constraint at 0.88
- Rule 10 (r12): hand disposition, classifier constraint at 0.68
