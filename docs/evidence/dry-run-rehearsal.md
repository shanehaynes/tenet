# Fresh-clone rehearsal (2026-10-22)

A rehearsal of the README path, not the M17 measurement: M17 is Shane's stopwatch run on his own machine (`dry-run.md`). This checks that a clean clone works before he times it.

Machine: Linux, Node 22.23.1, warm npm cache. Folder: a new empty directory with no `.env` in it or above it, so the no-key path was tested too.

| Step (README) | Result |
|---|---|
| 2. `git clone … && npm install` | Cloned in 1 s, installed in 5 s (649 packages; the cache was warm, so a first install will take longer). |
| 4. `npm run doctor` | Node 22.23.1 ok; ".env none found in ./ or ../"; no key; "No API key found. Put PORTKEY_API_KEY in a .env file in the repo folder or one folder above it, or run with --provider mock." Clear. |
| CLI, mock | `npm run tenet -- run samples/harrow-vale.md --accept-proposed --provider mock` completed: 13 rules, 73 scenarios, report printed. |
| Troubleshooting, "No key at all" | `TENET_PROVIDER=mock npm run dev`: `/api/health` 200 (provider mock, key spend $0); `/` 200; `/runs` 200; `/runs/example` 200 (the archived fresh demo run, rendered from files, no model); `/example/report.html` 200. |

Not covered here: the live path with a key (doctor's test call and a live run). Those were exercised the same day from the working copy: doctor, and demo run `449NHijnXq` through the UI.

Nothing in the README needed fixing. One thing to know: a mock run prints a cost (for example $0.0273). That is the cost estimated for its synthetic tokens; it does not count toward the key budget, and the app footer says "Mock provider".
