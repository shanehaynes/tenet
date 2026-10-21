# Static prefix measurement

Measured 2026-10-21T22:39:34.088Z on gpt-6-luna via portkey, demo policy (Harrow & Vale). Each prefix is sent twice with the same user message; "cached on repeat" is the second call's `cached_tokens`. The estimate divides characters by 5.2.

| Prefix | Characters | Estimated tokens | Prompt tokens (first call) | Chars per token | Cached on repeat |
|---|---|---|---|---|---|
| executor | 5565 | 1071 | 1075 | 5.18 | 1072 |
| classifier | 7485 | 1440 | 1668 | 4.49 | 1665 |

History: on 2026-10-21 the first executor preamble measured 884 prompt tokens (4,554 characters) and was not cached on repeat (0 cached), because the chars ÷ 4 estimate had overstated it by 29 %. The preamble gained two paragraphs (systems the assistant can use; stating actions taken) and the estimate was recalibrated.
