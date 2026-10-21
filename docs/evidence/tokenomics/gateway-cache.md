# Gateway response cache (Portkey)

Measured 2026-10-21T22:30:12.217Z with `npx tsx scripts/probe-gateway-cache.ts`, model gpt-6-luna. The same request sent three times (the third 10 s after the second, since the cache may be written asynchronously), then once with `x-portkey-cache-force-refresh: true`.

| Call | x-portkey-cache-status | ms | Output tokens | Reply |
|---|---|---|---|---|
| first | HIT | 395 | 18 | Blue |
| identical repeat at once | HIT | 191 | 18 | Blue |
| identical repeat 10 s later | HIT | 114 | 18 | Blue |
| repeat with x-portkey-cache-force-refresh | REFRESH | 1272 | 21 | Blue |
