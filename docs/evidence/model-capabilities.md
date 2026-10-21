# Model capabilities (M01)

Produced by `npm run smoke` on 2026-10-21T20:46:22.704Z. Provider `portkey`, model string `gpt-6-luna`.

| Step | Result | Detail |
|---|---|---|
| 1 auth and model string | ok | portkey accepts "gpt-6-luna" |
| 2 structured outputs | strict | strict json_schema accepted |
| 3 sampling controls | temperature rejected | reasoning_effort accepted: low, none, medium |
| 4 token accounting | cached on repeat | prefix 1075 input tokens; repeat cached 1072; reasoning tokens 0 |
| 4b prompt_cache_key | accepted |  |
| 5 rate limits | 0 of 8 rate-limited | suggested concurrency 8 |
| 6 latency | median 263 ms | 18 calls |

| Capability | Value |
|---|---|
| Structured output mode | strict |
| temperature accepted | false |
| reasoning_effort values accepted | low, none, medium |
| prompt_cache_key accepted | true |
| cached tokens reported | true |
| cached on repeated 1,100+ token prefix | true |
| reasoning tokens reported | true |
| suggested concurrency | 8 |
| median latency (ms) | 263 |

Smoke cost: 18 calls, $0.0002 at list price.
