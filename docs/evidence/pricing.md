# gpt-6-luna list prices (M02)

Confirmed 2026-10-21 at https://developers.openai.com/api/docs/pricing (Standard tier, short-context requests of up to 272K input tokens), per 1M tokens:

| Model | Input | Cached input | Output |
|---|---|---|---|
| gpt-6-luna | $0.10 | $0.01 | $0.50 |

These match Tenet's defaults (`TENET_PRICE_INPUT_PER_M`, `TENET_PRICE_CACHED_PER_M`, `TENET_PRICE_OUTPUT_PER_M`). Reasoning tokens are billed as output and are included in `completion_tokens`. For reference, the same page lists Batch and Flex at $0.05 / $0.005 / $0.25 and Fast at $0.20 / $0.02 / $1.00; Tenet's calls go through the course's Portkey gateway at the Standard rate.

The report states cost as "logged tokens × published list price (confirmed 2026-10-21)". The course gateway may bill differently; the $40 key budget is tracked from these logged figures.
