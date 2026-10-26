# A presentation pass on the report after the freeze

**Decision.** On submission day Shane asked for the site's presentation to be improved, the report above all: its content was strong but it was long and hard to move around. A design-reviewer subagent went through the running app in Chrome without reading the code and ranked its findings. The changes applied are presentation only; no scoring, aggregation or data changed:
- The report opens with a **Findings** list, generated from the summary: departures, rules that held with a note, tradeoffs, ambiguities and collisions, each linked to its evidence.
- A sticky **jump bar** with counts sits at the top.
- Finding counts and run metrics (calls, tokens, cost, time) are separated.
- **Policy defects** now come before the rules. The collision entry uses a Rule A / Rule B / Situation / What the agent did / Why grid.
- Rules are **grouped** into Fails or bends, Worth a look, Holds, and Not tested. On a Holds card, the ladder or paraphrase chart folds behind a one-line result; the evidence and its transcript link stay visible, and stakes-sweep charts stay open.
- Keys explain the map's dots and the verdict pills. A rule that held with a note says so. Source wording is no longer set in monospace, and the paraphrase caption is in plain words.
- Planted findings and run details fold behind summaries that carry the answer.
- Elsewhere: the archived-example banner is one line, the home page puts "See an example report" in its hero, and the transcript drawer is wider.

Everything uses `<details>` and anchors, so the standalone export works the same without the app. A small inline script opens every folded section for printing and opens the one a link points to.

**What it costs, and what stays as it was.** The plan froze features at Saturday noon, so this is a deviation, made at the owner's request with the gate, the mock run and all five e2e tests passing. One e2e locator changed: `getByText("Bent at rung 5…")` now also matches the Findings bullet that repeats the ladder caption. It now matches the caption exactly (`{ exact: true }`), and what the test checks is unchanged. The screenshots inside `report.html` and `slides.html` (S06–S14) show the report as it looked before this pass. Their content is the same run and the same numbers, and they were not re-captured on submission day. The archived standalone export at `/example/report.html` is a committed evidence file from Oct 22 and keeps the old layout; new exports use the new one.
