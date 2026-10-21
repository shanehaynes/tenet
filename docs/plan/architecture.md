# Tenet architecture and engineering spec

Companion to [PLAN.md](../../PLAN.md). This file fixes the engineering decisions so the building session does not re-deliberate them. "MUST" is a requirement the PRD or the course imposes; "SHOULD" is the chosen default, change it only with a note in `docs/decisions/`.

Source requirements: [docs/PRD.md](../PRD.md) (Technical design, Requirements) and the course page (https://zlisto.github.io/mgt_409_fa26/project_requirements.html).

---

## 1. Stack and versions

Versions below were current on npm on 2026-10-20. Run `npm view <pkg> version` before installing; prefer the major listed here.

| Layer | Choice | Version guidance | Notes |
|---|---|---|---|
| App | Next.js, App Router, Node runtime | 16.x (Turbopack default, React 19) | *Amended 2026-10-21:* Node ≥ 22.12 required (openai 7 and vitest 5); `.nvmrc` = `22`, `engines.node = ">=22.12"` |
| Language | TypeScript | **pin `typescript@5.9.3` exactly** | npm `latest` is 7.0 (native compiler); typescript-eslint rejects ≥ 6.1. Do not upgrade. eslint stays on 9. |
| Styling | Tailwind CSS v4 (from create-next-app) | 4.x | Light theme only for v1 (saves time, prints well) |
| UI kit | shadcn/ui, optional | latest | 20-minute timebox. If `npx shadcn@latest init` fights Tailwind 4 / React 19, drop it and hand-write ~6 components. |
| Validation | zod | 4.x | Use `zod` (v4 API). OpenAI helpers accept it. |
| Model SDK | openai | 7.x | Chat Completions via Portkey base URL. *Amended 2026-10-21:* the 7.0.0 breaking change is the Node 22 requirement; `zodResponseFormat` accepts zod v4. Use `.create()`, not `.parse()`. |
| Concurrency | p-limit | 7.x | Or a 20-line hand-rolled pool |
| Env | dotenv | 18.x | Only for `../.env`; Next loads `./.env` itself |
| Unit tests | vitest | 5.x | |
| E2E / screenshots | @playwright/test | 1.6x | `npx playwright install chromium` once |
| Scripts | tsx | 4.x | CLI and scripts run with `tsx` |
| Slides | reveal.js from a CDN | 5.x or 6.x | Course requires CDN load; pin an exact version in the URL |
| **Not used** | Recharts | | Decision: hand-rolled SVG chart (section 10). Recharts' `ResponsiveContainer` does not render in server-side static export. |
| **Not used** | portkey-ai SDK | | The gateway URL is a constant; the OpenAI SDK suffices |

### Scaffold

`create-next-app` refuses a non-empty directory, and this repo already holds `PLAN.md` and `docs/`. Scaffold in a sibling folder and copy in:

```bash
cd /home/shanehaynes/projects
# amended 2026-10-21: --no-cache-components keeps the dynamic/runtime route exports legal
npx create-next-app@16.4.2 tenet-scaffold --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --use-npm \
  --no-react-compiler --no-cache-components --no-agent-feedback --agents-md --disable-git --skip-install
rsync -a --ignore-existing tenet-scaffold/ Tenet/ && rm -rf tenet-scaffold
cd Tenet && npm pkg set engines.node=">=22.12" && echo 22 > .nvmrc
npm i zod@^4 openai@^7 p-limit@^7 dotenv@^18
npm i -D typescript@5.9.3 @types/node@^22 vitest@^5 vite@^8 @playwright/test@^1.64 tsx@^4
```

Then commit the skeleton before writing any feature code. Done 2026-10-21 (`3b81f7c`); see `docs/decisions/2026-10-21-scaffold-and-versions.md`.

---

## 2. Repository layout

```
Tenet/
  PLAN.md  CLAUDE.md  STATUS.md  README.md  .env.example  .nvmrc  package.json
  report.html  slides.html                 # course deliverables, built by scripts (evidence-report-slides.md §2–3)
  docs/
    PRD.md                                 # local copy of the PRD
    plan/                                  # this plan's appendices
    decisions/YYYY-MM-DD-<slug>.md         # decision records
    evidence/                              # every number and screenshot the report cites (see evidence-report-slides.md)
  samples/                                 # sample policies (.md) + hand labels (.labels.json)
  data/                                    # runtime state, git-ignored except .gitkeep and fixtures/
    capabilities.json
    policies/<policyId>.json
    runs/<runId>/...
    fixtures/                              # recorded model responses for replay mode (committed, small)
  src/
    app/                                   # Next.js routes (thin: parse request, call core, return JSON/HTML)
      page.tsx                             # policies: samples, paste, upload
      runs/page.tsx                        # run history
      runs/[runId]/review/page.tsx         # rules table, overrides, confirm
      runs/[runId]/collisions/page.tsx     # collision pairs, dismiss, Run tests
      runs/[runId]/progress/page.tsx       # live progress
      runs/[runId]/report/page.tsx         # the report
      api/...                              # route handlers (section 8)
    core/                                  # framework-free library: usable from Next and the CLI
      env.ts                               # .env then ../.env
      ids.ts  time.ts  text.ts             # small utilities (normalize, fuzzy match)
      model/
        client.ts                          # callModel(): the one wrapper every LLM call uses
        providers/{portkey,openai,mock,replay}.ts
        capabilities.ts                    # probe + cache what the model/gateway supports
        pricing.ts  usage.ts
      schemas/                             # zod schemas: agent outputs + stored records
      agents/
        scanner.ts decomposer.ts classifier.ts collisions.ts
        generators/{ladder,sweep,paraphrase,conflict,flat}.ts
        judge.ts reporter.ts
      pipeline/
        analysis.ts                        # scan → decompose → classify
        execution.ts                       # generate → execute → judge → report
        budget.ts  guards.ts  jobs.ts      # spend cap, loop guards, in-process job registry
        aggregate.ts                       # rule verdicts, thresholds, consistency, summary
      store/
        fs.ts                              # atomic JSON read/write, jsonl append
        policies.ts  runs.ts
      report/
        ReportDocument.tsx                 # shared React tree: in-app page and standalone export
        ThresholdChart.tsx  LadderStrip.tsx  ParaphraseDots.tsx   # pure SVG
        exportHtml.ts                      # renderToStaticMarkup + inline CSS
        csv.ts
    components/                            # UI components (tables, badges, drawer, progress)
    cli/
      index.ts                             # `npm run tenet -- <command>`
  scripts/
    smoke.ts                               # model smoke test → data/capabilities.json
    doctor.ts                              # env + node + key check for README step 2
    eval-classifier.ts  kappa.ts  spotcheck.ts  timing.ts
    build-report.mjs  build-slides.mjs  check-secrets.mjs
  tests/                                   # vitest: unit + pipeline (mock)
  e2e/                                     # playwright: happy path, quarantine, halt, screenshots.spec.ts
  .github/workflows/ci.yml
```

Rule: nothing under `src/core` imports from `next/*` or `react` except `src/core/report/*` (React only, no Next). The CLI and the tests exercise `src/core` directly.

---

## 3. Environment

### 3.1 Loading order (course MUST)

The app MUST find `.env` first in the repo folder, then one level up. Staff's `.env` holds only `PORTKEY_API_KEY` and `OPENAI_API_KEY`; every other variable MUST have a working default.

Next.js loads `./.env` on its own but never `../.env`. Add a loader that every server entry point (route handlers, CLI, scripts) calls before touching keys:

```ts
// src/core/env.ts
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

let loadedFrom: string | null | undefined;

export function loadEnv(): string | null {
  if (loadedFrom !== undefined) return loadedFrom;
  const candidates = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "..", ".env")];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    config({ path: p, override: false });           // never clobber real env vars
    if (process.env.PORTKEY_API_KEY || process.env.OPENAI_API_KEY) { loadedFrom = p; return p; }
  }
  loadedFrom = null;
  return null;
}
```

`npm run doctor` prints: Node version, which `.env` path was used (or "none found"), which keys are present (masked to the last 4 chars), the provider that will be used, and then makes one 10-token model call (smoke step 1 only). The README's step 2 is "run `npm run doctor`". The full `npm run smoke` is for Shane and the building session, not for staff.

### 3.2 Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORTKEY_API_KEY` | one of the two keys | | Course key; routes `gpt-6-luna` through Portkey |
| `OPENAI_API_KEY` | one of the two keys | | Fallback provider when Portkey key is absent; optional alternate judge |
| `TENET_PROVIDER` | no | `auto` | `auto` \| `portkey` \| `openai` \| `mock` \| `replay` |
| `TENET_TARGET_MODEL` | no | `gpt-6-luna` | Model under test |
| `TENET_JUDGE_MODEL` | no | = target | Alternate judge (needs a provider that can reach it) |
| `TENET_JUDGE_PROVIDER` | no | = provider | |
| `TENET_SPEND_CAP_USD` | no | `2` | Per-run cap; UI can override per run |
| `TENET_CONCURRENCY` | no | `4` | Parallel model calls during execution |
| `TENET_AMBIGUITY_THRESHOLD` | no | `0.7` | Classifier confidence cutoff |
| `TENET_PRICE_INPUT_PER_M` | no | `0.10` | USD per 1M uncached input tokens (gpt-6-luna list price) |
| `TENET_PRICE_CACHED_PER_M` | no | `0.01` | USD per 1M cached input tokens |
| `TENET_PRICE_OUTPUT_PER_M` | no | `0.50` | USD per 1M output tokens |
| `TENET_DATA_DIR` | no | `./data` | |
| `TENET_RECORD` | no | unset | `1` records live responses into `data/fixtures/` |
| `TENET_AGENT_URL` | no | unset | Default URL of an HTTP agent target (section 4.6), e.g. `http://localhost:8000/tenet/ask` |
| `TENET_AGENT_NAME` | no | unset | Display name for that target, e.g. `Campus Customs (HW5)` |
| `TENET_KEY_BUDGET_USD` | no | `40` | *Added 2026-10-21.* Cumulative budget on the key, read from `data/usage-global.jsonl`: warning at 75 %, live calls refused at 95 % |
| `TENET_ALLOW_OVER_KEY_BUDGET` | no | unset | `1` lets live calls continue past 95 % of the key budget |

*Amended 2026-10-21:* `PORT` is a shell variable only (Next does not read it from `.env`); `next dev` prints the URL it chose.

Prices are third-party reports of OpenAI's list price as of 2026-10-20 ($0.10 / $0.01 cached / $0.50). Confirm at https://developers.openai.com/api/docs/pricing on day 1 and record the confirmed figures (with date) in `docs/evidence/pricing.md`. The report labels cost as "logged tokens × published list price (confirmed <date>)".

`.env.example` lists exactly the two keys with comments and, below a divider, the optional variables commented out with their defaults.

---

## 4. Model access

### 4.1 What the course setup tells us

The course's Codex configuration (Mac setup guide) is:

```toml
[model_providers.portkey]
name = "Portkey"
base_url = "https://api.portkey.ai/v1"
env_key = "PORTKEY_API_KEY"
model = "gpt-5.6-luna"        # the project requires gpt-6-luna
model_provider = "portkey"
model_reasoning_effort = "low"
```

Three facts follow. The gateway is OpenAI-compatible at `https://api.portkey.ai/v1`. The workspace API key carries its own routing, so the bare model name works and no provider or virtual-key header is needed (Codex sends the key as `Authorization: Bearer`). The Luna models take `reasoning_effort`, which means they are reasoning-style models and may reject `temperature`. All three are verified by the smoke test, not assumed.

Shane's own HW5 backend (github.com/shanehaynes/Homework5, `backend/team.py`) confirms the pattern in production: PydanticAI's `OpenAIResponsesModel("gpt-6-luna", provider=OpenAIProvider(base_url="https://api.portkey.ai/v1", api_key=PORTKEY_API_KEY))`, no extra headers, served as `gpt-6-luna-global`, with `cache_read_tokens` reported in usage. Smoke step 1 should pass on its first variant, and the Responses API is a working fallback through the gateway if Chat Completions ever misbehaves.

### 4.2 Client construction

```ts
import OpenAI from "openai";
const client = new OpenAI({
  apiKey: process.env.PORTKEY_API_KEY!,                // Portkey accepts its key as the bearer token
  baseURL: "https://api.portkey.ai/v1",
  defaultHeaders: { "x-portkey-api-key": process.env.PORTKEY_API_KEY! },  // belt and braces
  timeout: 90_000,                                       // amended 2026-10-21: one timeout, 90 s per request
  maxRetries: 0,                                         // we do our own retries so they are logged
});
```

Model string order of preference: `gpt-6-luna`, then `@openai/gpt-6-luna` (Portkey model-catalog form). The smoke test finds the first that works and writes it to `data/capabilities.json` (keyed `provider:model`). *Amended 2026-10-21:* the client uses the probed string and does not fall back at runtime; `TENET_PROVIDER=auto` resolves Portkey, then OpenAI, then fails with "no key; use --provider mock" (never a silent mock).

For `TENET_PROVIDER=openai`: `new OpenAI({ apiKey: OPENAI_API_KEY })`, same model string, no headers.

### 4.3 Smoke test (`npm run smoke`): the first thing to run with a key

Writes `data/capabilities.json` and prints a table. Steps, in order, stopping at the first working variant for step 1:

1. **Auth and model string.** Try `{bearer, "gpt-6-luna"}`, `{bearer + x-portkey-api-key, "gpt-6-luna"}`, `{…, "@openai/gpt-6-luna"}`. A 10-token "reply with OK" call. Record `modelString` and `headers`.
2. **Structured outputs.** Send `response_format: { type: "json_schema", json_schema: { strict: true, ... } }` with a 2-field schema. 200 → `strictJsonSchema: true`. 400 → try `{ type: "json_object" }` → `jsonObject: true`. Neither → `jsonMode: "prompt-only"`.
3. **Sampling controls.** Send `temperature: 0`. 400 mentioning temperature → `temperature: false`. Then `reasoning_effort: "low"` → record `reasoningEffort: true|false`. Also try `"minimal"`; record which values are accepted.
4. **Token accounting.** Send a 1,200-token system prompt twice. Check `usage.prompt_tokens`, `usage.completion_tokens`, `usage.prompt_tokens_details?.cached_tokens`. Record `cachedTokensReported: true|false` and whether the second call's cached count was > 0. If the field is absent, the app logs `cachedTokens: null` and the report labels cached-input as "not reported by gateway; estimated as 0". Also record `usage.completion_tokens_details?.reasoning_tokens`. This step proves the gateway reports caching; whether the app's own prompts are long enough to be cached is enforced separately by the prefix-budget unit test (section 4.4).
5. **Rate limits.** Fire 8 parallel 10-token calls. Count 429s and read `retry-after`. Record `suggestedConcurrency` (8 → no 429s; 4 → some; 2 → many).
6. **Latency.** Median of the above, in ms. Used to predict run time (section 7).

Capabilities shape:

```ts
type Capabilities = {
  provider: "portkey" | "openai"; modelString: string; headers: Record<string,string>;
  strictJsonSchema: boolean; jsonObject: boolean;
  temperature: boolean; reasoningEffort: false | string[];
  cachedTokensReported: boolean; suggestedConcurrency: number; medianLatencyMs: number;
  probedAt: string;
};
```

If `data/capabilities.json` is missing at runtime (staff machine), the client probes steps 1–3 lazily on the first call (about 3 cheap calls) and saves the file. Staff never run `smoke` by hand unless `doctor` tells them to.

### 4.4 `callModel`: the single wrapper (PRD MUST)

Every LLM call in the codebase goes through this function. No exceptions, including the smoke test's measured calls once the app exists.

```ts
type CallArgs<T> = {
  runId: string | null; stage: Stage;                       // Stage = 'scanner'|'decomposer'|'classifier'|'collisions'|'generator'|'executor'|'judge'|'reporter'|'probe'
  ruleId: string | null; scenarioId: string | null;         // for per-rule cost and timing (M10, M13)
  system: string; user: string;                             // static first, variable last (caching)
  schema?: ZodType<T>; schemaName?: string;                 // omit for free text (executor)
  maxOutputTokens: number; role?: "target" | "agent";       // target = the model under test (no JSON); caps include reasoning tokens
  signal?: AbortSignal;
};
type CallResult<T> = { data: T; text: string; usage: UsageEvent; finishReason: string };
```

Behavior, in order:

1. `budget.assertCanSpend(runId)` — throws `BudgetExceeded` if the run's logged spend ≥ cap, or if `guards.callCount(runId) ≥ MAX_CALLS_PER_RUN` (default 600).
2. Build the request: `model`, `messages: [{role:"system"}, {role:"user"}]`, `max_completion_tokens` (never `max_tokens`; sized for reasoning tokens, which count against it: target 2,000, judge 1,500, classifier 800, scanner, collisions and reporter 1,200, generators 6,000), `temperature: 0` only if capabilities allow, `reasoning_effort: "low"` only if allowed, `response_format` per capabilities when a schema is given (strict `json_schema` via `zodResponseFormat(schema, schemaName)` from `openai/helpers/zod`; else `json_object` plus the JSON schema pasted into the system prompt; else prompt-only).
3. Send with a 90 s timeout (reasoning models are slower; a generator call can take 20–40 s).
4. Retry policy: network error, 5xx, timeout → one retry after 1 s. 429 → wait `retry-after` or 2 s / 4 s / 8 s, up to 3 waits; these do not count as the retry. Every attempt is logged as its own `UsageEvent` with `attempt` and `ok`.
5. Parse: strict mode → `JSON.parse` + `schema.parse`. Other modes → extract the first `{…}` block, `schema.safeParse`; on failure, one repair call with the Zod error appended ("Your previous output failed validation: … Return only corrected JSON."). Still failing → throw `SchemaInvalid` (the caller decides: scenario marked `not_run`, or the stage fails).
6. Log `UsageEvent { runId, ruleId, scenarioId, stage, model, inputTokens, cachedTokens, reasoningTokens, outputTokens, ms, usd, attempt, ok, finishReason, error? }` to `data/runs/<runId>/usage.jsonl` and always to `data/usage-global.jsonl` (the cumulative spend on the key across every run and probe; the course key has a $40 budget, so the footer, `tenet status` and M21 show this total), and add `usd` to the run's running total.
7. For `role: "target"` calls, `finish_reason: "length"` triggers one retry with the cap doubled; if still truncated, the transcript is stored with `truncated: true`, the judge's user message says the reply was cut off, and the summary counts it. *Amended 2026-10-21:* every stage gets the doubled-cap retry (at most 12,000) before any repair call; an agent call still cut off throws `SchemaInvalid`. Before step 1, the key-budget check reads the cumulative spend in `data/usage-global.jsonl` (warning at 75 % of `TENET_KEY_BUDGET_USD`, refusal at 95 %).

Cost: `usd = ((input − cached) × pIn + cached × pCached + output × pOut) / 1e6`, where `output` is `completion_tokens`, which already includes reasoning tokens (billed as output); `reasoningTokens` is logged separately for the tokenomics breakdown. If `cached` is null, treat as 0 and set `cachedTokens: null` in the log so the report can say so.

Strict-schema rules (OpenAI structured outputs): top-level must be an object; every field required (use `.nullable()` instead of `.optional()`); no `z.record`, no unions of objects without a discriminator, no `.default()`; enums fine; keep descriptions short. Define every agent schema in `src/core/schemas/agents.ts` and unit-test that `zodResponseFormat` accepts each one (it throws at build time for unsupported shapes, which is a cheap test).

**Prefix budget.** OpenAI caches only prefixes of 1,024+ tokens that are byte-identical across calls. The first drafts of the executor, judge and classifier prefixes were 600–800 tokens, so caching would never have shown. `tests/unit/prefix-budget.test.ts` builds every static system prompt (executor preamble + demo policy, judge prefix for the demo policy, classifier prefix for the demo policy, each generator header + demo policy) and asserts ≥ 1,100 tokens by a chars ÷ 4 estimate (or a tokenizer package if one is installed). *Amended 2026-10-21:* measured against gpt-6-luna, chars ÷ 4 overstated real prompt tokens by 13–29 %; the test now divides by 5.2 (`src/core/model/tokens.ts`) with a floor of 1,050, and `npm run measure:prefixes` records real counts and cache hits. The agents doc enriches each prefix with content that is useful anyway (section 0 there). For a very short user policy the executor prefix may still fall under 1,024 tokens; the report notes that caching then does not engage.

### 4.5 Mock and replay providers

- **mock** (`TENET_PROVIDER=mock`): deterministic, offline, zero cost. Implements the same `callModel` contract by dispatching on `stage` to a heuristic (specified per agent in [agents-and-prompts.md](agents-and-prompts.md)). Returns a synthetic `usage` (token counts from `text.length / 4`) so the cost UI shows numbers. The whole app, the CLI, the tests and CI run in mock mode without a key. The mock plants the demo failures (rule 2 bends at rung 5, reframing, and folds at rung 6, sunk cost; rule 10 complies through $12,000 and escalates from $25,000) so screenshots and UI work can proceed before live runs exist.
- **replay** (`TENET_PROVIDER=replay`; built in Phase 3 if time, nothing before Gate 1 needs it): looks up `data/fixtures/<sha256(stage + system + user + schemaName)>.json`; on a hit returns the recorded response (usage included); on a miss falls through to the live provider and, if `TENET_RECORD=1`, records it. Lets the session iterate on the report UI against real transcripts for free, and makes the demo run reproducible offline. Fixtures are small JSON; commit the demo run's fixtures.

### 4.6 Targets: the thing under test

"Pick an agent to test" (the professor's phrase) means the executor talks to a `Target`, not always to a bare model:

```ts
type Target =
  | { kind: "model"; provider: "portkey" | "openai"; model: string }                       // default: policy as system prompt (agents §6)
  | { kind: "http"; name: string; url: string; agent: string | null; headers: Record<string,string>; timeoutMs: number; resetPerScenario: boolean };
```

**HTTP target protocol** (generic; the HW5 bridge implements it, sample-policies §10):

```
POST {url}
{ "message": "<scenario.user_turn>", "conversation_id": "<scenarioId>", "reset": true, "agent": "customer_service" | null }
→ 200 { "reply": "<the agent's final answer as plain text>",
        "actions": [{ "name": "<tool>", "arguments": {…}, "result": {…} }],        // tool calls the agent made, in order; [] if none
        "usage": { "input_tokens": n, "output_tokens": n, "cached_tokens": n, "requests": n } | null,
        "meta": { "root_run_id": "…", "ms": n } }
→ 409 { "error": "busy" }                                                          // a run is in progress; Tenet waits 2 s and retries, up to 10 times
```

Rules for HTTP targets: no system prompt is injected (the agent has its own); concurrency is forced to 1 (one shared database and one MCP process on the HW5 side); `reset: true` on every scenario so each starts from the same state; timeout 120 s, one retry; the reply becomes the assistant message of the transcript and `actions` is stored beside it and shown in the transcript drawer as an "Actions" table; the judge's user message carries the actions block (agents §7); target-side usage, when reported, is logged as a `UsageEvent` with `stage: "target"` so cost per policy audit includes it, flagged as reported by the target rather than measured by Tenet's wrapper. Scenario generators are told the audience is a human operator of the agent team, so the messages read as operator requests (agents §5).

The target is chosen on the run panel ("Agent under test": the default model target, plus an HTTP target when `TENET_AGENT_URL` is set or a URL is typed), stored in `Run.config.target`, printed on the report, and selectable from the CLI (`--target http --agent-url … --agent customer_service`).

---

## 5. Data model and storage

JSON on disk (PRD decision). SQLite is a P2 swap; do not build it.

```ts
type RuleType = "constraint" | "tradeoff" | "disposition" | "ordering";
type Policy = { id; name; text; source: "sample" | "paste" | "upload"; flagged: boolean; scan: ScanResult | null; createdAt };
type RunStatus = "created" | "scanning" | "quarantined" | "decomposing" | "classifying" | "awaiting_review"
  | "mapping_collisions" | "awaiting_collision_review" | "generating" | "executing" | "reporting"
  | "complete" | "halted" | "failed" | "interrupted" | "cancelled";
type Run = { id; policyId; policyName; createdAt; updatedAt; status: RunStatus; statusReason: string | null;
  config: { provider; target: Target; targetModel; judgeModel; spendCapUsd; concurrency; ambiguityThreshold; flatComparison: boolean };
  heartbeatAt: string | null; startedExecutionAt; finishedAt; wallClockMs: number | null;
  totals: { calls; inputTokens; cachedTokens: number | null; reasoningTokens: number | null; outputTokens; usd; analysisUsd; testUsd } };   // amended 2026-10-21
type Rule = { id; runId; index; statement; quote; span: { start; end } | null; located: boolean;
  proposedType: RuleType | null; probabilities: Record<RuleType, number> | null; confidence: number | null; rationale: string | null;
  userType: RuleType | null; parked: boolean; parkedReason: "low_confidence" | "user" | "untestable" | null;
  origin: "extracted" | "split" | "merged"; parentIds: string[];
  coverage: "tested" | "p1_type_not_run" | "parked" | "not_run" | null };   // set by aggregate; p1_type_not_run only when a type's generator is disabled (the Gate 1 cut line)
type Collision = { id; runId; ruleA; ruleB; scenario; whyConflict; dismissed: boolean };
type ScenarioKind = "ladder" | "sweep" | "paraphrase" | "conflict" | "flat";
type Scenario = { id; runId; ruleId: string | null; collisionId: string | null; kind: ScenarioKind; index: number;
  tactic?: LadderTactic; variable?: { name; unit; kind }; value?: number | string; label?: string; dimension?: string;
  context: { persona; situation } | null; userTurn: string; status: "pending" | "running" | "done" | "not_run"; error: string | null };
type Transcript = { scenarioId; systemPrompt: string | null; messages: {role; content}[]; finishReason; truncated: boolean; ms; model;
  actions: { name; arguments; result }[] | null;                  // HTTP targets: the tool calls the agent made
  targetUsage: { inputTokens; outputTokens; cachedTokens; requests } | null };
type Verdict = { scenarioId; rubric: ScenarioKind; verdict: string; evidence: string | null; verified: boolean; confidence: number; note: string | null; judgedAt };
type UsageEvent = { ts; runId; ruleId: string | null; scenarioId: string | null; stage; model; inputTokens; cachedTokens: number | null; reasoningTokens: number | null; outputTokens; ms; usd; attempt; ok: boolean; finishReason: string | null; error: string | null;
  // amended 2026-10-21:
  provider; role: "agent" | "target"; kind: "call" | "retry" | "repair" | "length_retry"; responseMode: "strict" | "json_object" | "prompt" | "text"; usageEstimated: boolean; reportedByTarget: boolean };
// Ids (amended 2026-10-21): policies and runs random base62; rules r{n}; scenarios r2-L5 / r10-S3 / r6-P4 / r8-C1 / c1-C1 / r2-F1; collisions c{n}.

// The contract between aggregate.ts (Phase 2), the report and export (Phase 3) and the evidence scripts (Phase 4). Zod schema in src/core/schemas/summary.ts; finalize it first thing in Phase 2.
type RuleCard = {
  ruleId; index; statement; quote; type: RuleType | null;
  coverage: Rule["coverage"]; testKind: ScenarioKind | null;
  verdict: "pass" | "partial" | "fail" | "unclear" | "observed" | "not_run" | "designed_not_run" | "parked";
  ladder: { rungs: { index; tactic; verdict; verified; scenarioId }[]; bentAt: number | null; foldedAt: number | null } | null;
  sweep: { variable: { name; unit; kind }; points: { index; value; label; behavior; verified; scenarioId }[];
           impliedThreshold: number | null; observedThreshold: { lastComplied: number | null; firstRequired: number | null };
           nonMonotonic: boolean; requiredBehaviorLabel: string } | null;
  paraphrase: { items: { index; dimension; traitScore; scenarioId }[]; consistency: number; modalScore: number; outlierScenarioIds: string[] } | null;
  conflicts: { scenarioId; honored; evidence; verified }[] | null;
  flat: { scenarioId; verdict; verified } | null;
  headlineEvidence: { scenarioId; quote; verified } | null;
  warnings: string[] };
type Summary = {
  runId; policyId; policyName; kind: "report" | "no_testable_rules"; generatedAt;
  strip: { rulesTotal; rulesTested; rulesP1NotRun; rulesParked: Record<string, number>; failures; partials; ambiguities; collisions;
           scenariosTotal; scenariosNotRun; unverifiedCount; truncatedCount;
           calls; inputTokens; cachedTokens: number | null; reasoningTokens: number | null; outputTokens; usd; analysisUsd; testUsd; wallClockMs };
  rules: RuleCard[];
  defects: { ambiguities: { ruleId; statement; probabilities; parkedReason; summary }[];
             collisions: { collisionId; ruleA; ruleB; scenario; outcome: { honored; evidence; verified } | null; summary }[] };
  typedVsFlat: { ruleId; flatVerdict; typedVerdict }[] | null;
  usageByStage: { stage; calls; inputTokens; cachedTokens: number | null; reasoningTokens: number | null; outputTokens; usd; medianMs }[];
  planted: { item: string; expected: string; found: boolean | null; detail: string }[] | null;   // demo policy only; rules identified by aligning quotes to samples/harrow-vale.labels.json (the eval script's alignment), never by index
  config: Run["config"] & { modelString: string; capabilities: Partial<Capabilities> } };
```

Disk layout per run:

```
data/runs/<runId>/
  run.json  rules.json  collisions.json  scenarios.json  verdicts.json  summary.json
  transcripts/<scenarioId>.json
  usage.jsonl   events.jsonl                    # append-only
```

Rules: the running job owns a run's mutable state in memory and persists it through a per-run single-writer queue (`store/runs.ts` exposes `withRun(runId, mutate)`, a promise chain per run), so four interleaved execute→judge chains can never read-modify-write the same file and lose an update. `store/fs.ts` writes to `<file>.<pid>.<random>.tmp` then renames, so a concurrent writer elsewhere cannot collide on the temp name. Route handlers only read. `events.jsonl` and `usage.jsonl` are append-only (`appendFile`, one JSON line per call, no queue needed). `events.jsonl` lines are `{ts, level, stage, message, data?}` and feed the progress view. IDs are 10-char base62 from `crypto.randomBytes`. `.gitignore`: `data/*`, then `!data/.gitkeep` and `!data/fixtures/` (git cannot re-include a path under an excluded directory, so `data/**` would hide the fixtures).

Resolving a rule's effective type: `userType ?? (confidence >= threshold ? proposedType : null)`; a rule with `null` effective type and `parked = false` blocks confirmation.

---

## 6. Run lifecycle

```
POST /api/runs {policyId}
  created → scanning → (flagged? quarantined ■) → decomposing → classifying → awaiting_review
PATCH rules (overrides) …
POST /api/runs/:id/confirm
  awaiting_review → mapping_collisions → awaiting_collision_review
POST /api/runs/:id/execute {spendCapUsd?, concurrency?, flatComparison?}      (dismiss collisions first via PATCH …/collisions)
  awaiting_collision_review → generating → executing → reporting → complete ■
  generating | executing | reporting: test budget exceeded or guard → halted ■ (statusReason names the stage)   unexpected error → failed ■
  process died mid-stage → interrupted (detected: heartbeat older than 60 s on read)
POST /api/runs/:id/resume      interrupted | halted (with a raised budget) → restarts the halted stage; scenarios already done are not re-run   (Phase 3, if time)
POST /api/runs/:id/cancel      → cancelled (AbortController)   (Phase 3, if time)
```

The scanner already ran when the policy was created (`POST /api/policies`); the run's `scanning` stage reuses that stored result without a model call and moves to `quarantined` if it was flagged, so the API path and the CLI path (`tenet analyze <file>` creates the policy and the run together) behave the same. Every scenario's transcript and verdict is persisted as it completes and `heartbeatAt` is updated every 5 s, so when `resume` is built it re-queues only scenarios with `status != done`; until then an interrupted run is re-executed from the start of its stage.

Re-run after a prompt change (P1, user story 6): `POST /api/runs/:id/rerun {systemPromptOverride?}` clones rules, collisions and overrides into a new run and starts at `generating` (reusing scenarios too, so the diff is apples to apples). The diff view compares `verdicts.json` across the two runs by `scenario.index` within each rule.

---

## 7. Pipeline orchestration

- `pipeline/analysis.ts`: `runAnalysis(runId, signal)` → scanner → (quarantine) → decomposer → classifier (one call per rule, concurrency = config) → `awaiting_review`.
- `pipeline/execution.ts`: `runExecution(runId, signal)` → generators (one call per confirmed rule and per kept collision, concurrency = config) → for each scenario a chained task `execute(scenario).then(judge)` through one `p-limit(concurrency)` pool → `aggregate.buildSummary()` → reporter summaries → `complete`.
- Interleaving execute and judge per scenario halves wall time versus stage-by-stage, and gives the progress view "scenarios judged" as a live counter.
- Jobs live in `pipeline/jobs.ts`: a `Map<runId, {promise, abort}>` stored on `globalThis.__tenetJobs` so Turbopack HMR in `next dev` does not create a second registry. Route handlers never await a job; they return 202 and the UI polls.
- Loop guards (`guards.ts`): `MAX_RULES_PER_RUN` 40, `MAX_SCENARIOS_PER_RULE` 12, `MAX_CALLS_PER_RUN` 600, `MAX_ATTEMPTS_PER_CALL` 2 (+3 rate-limit waits). No agent ever calls another agent; the orchestrator is plain code. Say exactly this in the README's safety section.
- HTTP targets (section 4.6): the pool runs at concurrency 1 whatever the config says, each scenario sends `reset: true`, a 409 from the bridge is retried after 2 s, and HW5 runs are capped at 6 rules and 40 scenarios by the run config (each HW5 scenario is several model calls and 10–20 s).
- Persistence: the job owns the run's mutable state in memory and writes through the per-run single-writer queue (section 5); route handlers only read.
- Budget (`budget.ts`): the cap is a **test budget**. It applies to spend since `startedExecutionAt` (generation, execution, judging, reporter), kept in memory and flushed to `run.json` after every call. Analysis spend (scanner, decomposer, classifier, collisions) is logged and shown separately and is bounded by the loop guards, not by the cap; otherwise a $0.01 demo budget would trip during classification before any scenario ran. The check happens before every call; on `BudgetExceeded` the pool drains (in-flight calls finish and are logged), remaining scenarios are marked `not_run` with `error: "test budget"`, status → `halted`, `statusReason: "Test budget $X reached during <stage> after N calls ($Y logged)"`. A halt before any scenario ran renders as "halted before execution".
- Progress endpoint derives counters from the in-memory state (or `scenarios.json` when no job is live) and `events.jsonl`; estimated time remaining = pending × median executor+judge latency ÷ concurrency.

Expected run size for the 13-rule demo policy with Shane's labels, all four types tested: 4 ladders (rules 1, 2, 3, 12) × 6 + 2 sweeps (rules 4, 10) × 8 + 3 paraphrase sets (rules 6, 7, 11) × 10 + ordering conflicts (rule 5: 1; rule 8: 2) + 1–3 collision scenarios = about 75 executor calls and 75 judge calls, plus ~11 generator calls, 13 classifier, 1 decomposer, 1 collision mapper, ≤ 3 reporter: about 180 calls. At 3–6 s per call (a reasoning model) and concurrency 4: 150–240 s, which is at the 3-minute target; at 6–8: 100–150 s. Default to the smoke test's `suggestedConcurrency` and prefer 6 when the key allows it. Rules 9 and 13 are parked, so they cost nothing.

Expected cost per run at list price: roughly $0.10–0.30 including reasoning tokens (billed as output); an HW5 agent run, where each scenario is several model calls on the agent side, $1–3. The default $2 cap will never trip on a model-target run; the halted-run screenshot sets a $0.01 test budget, which trips during generation or the first executor calls (the execute panel exposes the budget per run; display spend as `$0.0412`).

---

## 8. HTTP API

All handlers: `export const runtime = "nodejs"; export const dynamic = "force-dynamic";` and `import "server-only"` at the top of the handler file. `server-only` lives only under `src/app/**`: imported under plain Node (the CLI via `tsx`, vitest) that package throws, and `src/core` must load there. Request bodies validated with zod; errors return `{ error: { code, message } }` with 400/404/409.

| Method and path | Body → result | Notes |
|---|---|---|
| `GET /api/policies` | → `Policy[]` (text omitted) | Samples are seeded from `samples/*.md` on first read |
| `POST /api/policies` | `{name, text}` or multipart `.txt/.md` ≤ 200 KB → `Policy` | Runs the scanner immediately; `flagged` set |
| `GET /api/policies/:id` | → `Policy` with text and scan findings | |
| `POST /api/runs` | `{policyId, config?}` → `Run` (202) | 409 if policy flagged. Starts analysis job |
| `GET /api/runs` | → `Run[]` newest first | |
| `GET /api/runs/:id` | → `{run, rules, collisions, progress}` | Polled every 1 s by progress and review pages |
| `PATCH /api/runs/:id/rules` | `{ops: [{set_type}, {park}, {unpark}, {split: {ruleId, statements[]}}, {merge: {ruleIds}}]}` → rules | Only in `awaiting_review`. Split/merge create rules with `origin` and `parentIds`; new rules get `proposedType: null` and must be typed by the user |
| `POST /api/runs/:id/confirm` | → `Run` (202) | 409 unless every rule has an effective type or is parked |
| `PATCH /api/runs/:id/collisions` | `{dismiss: ids[], restore: ids[]}` | |
| `POST /api/runs/:id/execute` | `{spendCapUsd?, concurrency?, flatComparison?}` → `Run` (202) | Dismiss collisions first via the PATCH above; `spendCapUsd` is the test budget (section 7) |
| `POST /api/runs/:id/cancel` · `/resume` · `/rerun` | | |
| `GET /api/runs/:id/scenarios/:sid` | → `{scenario, transcript, verdict}` | Transcript drawer |
| `GET /api/runs/:id/report.html` | → standalone HTML (attachment) | Section 10 |
| `GET /api/runs/:id/usage.csv` | → CSV | Columns: ts, stage, ruleId, scenarioId, model, inputTokens, cachedTokens, reasoningTokens, outputTokens, ms, usd, attempt, ok, finishReason |
| `GET /api/runs/:id/summary.json` | → `Summary` | Used by `scripts/build-report.mjs` |
| `GET /api/health` | → `{ok, provider, model, envFile, capabilitiesProbed}` | README troubleshooting |

---

## 9. UI

Pages and what each must show (PRD "What the user sees at each stage"):

1. **`/` Policies.** Left: three sample cards (Harrow & Vale, Meridian Health, Northgate IT) plus the injected sample marked "safety demo", one-click "Analyze". Right: textarea + `.txt/.md` drop zone + name field. Empty submit → inline message. A flagged policy shows the quarantine banner (red, with the flagged lines quoted and the reason) and no Analyze button; "Edit text and re-scan" is the only action. Footer: provider/model badge from `/api/health`, and "No API key found" guidance when applicable.
2. **`/runs/:id/review`.** Stepper (Classify → Review → Collisions → Run → Report). Table: #, source quote (monospace, truncated with expand), statement, proposed type with confidence as a small bar, rationale, type dropdown (four types), Park toggle, row menu: Split (dialog with one textarea per new statement), Merge (select rows, button in toolbar). Low-confidence rows tinted amber and pre-parked with reason `low_confidence`; the user can assign a type to un-park. Toolbar: "Confirm N rules (M parked)" disabled until the rule above holds, with the reason shown. Choosing disposition or ordering shows an inline note only if those generators are not built yet ("reported as designed, not run"). Below the table: the **ambiguity map** (section 10) drawn from the proposed classification, parked rules hollow, so the user sees the policy's shape before any test runs.
3. **`/runs/:id/collisions`.** Cards: rule A, rule B, the scenario sentence, why they conflict, Dismiss toggle. Run panel: **Agent under test** (the default model target; an HTTP agent when `TENET_AGENT_URL` is set or a URL is typed, with the agent name field for HW5), test budget, concurrency (locked to 1 for HTTP targets), "Also run flat pass/fail comparison" (P1), "Run tests" button. Empty state: "No collisions proposed".
4. **Live report.** `/runs/:id/report` renders as soon as execution starts and fills in as verdicts arrive ("watch the results come in"): a header with per-stage counters (scenarios generated / executed / judged), overall bar, elapsed and estimated remaining, test spend vs budget with analysis spend beside it, the last 10 events, Cancel (Phase 3), and the halted states (a red panel with `statusReason`; "halted before execution" when no scenario ran; Resume once it exists; "run again" for `interrupted` until then). Cards appear with pending rungs and points and fill in as verdicts land; `aggregate` runs on partial state. `/runs/:id/progress` redirects here.
5. **`/runs/:id/report`.** Renders `ReportDocument` (shared with export). Summary strip: rules tested, failures, partials, ambiguities, collisions, not run, unverified, calls, tokens (input / cached / output), cost, wall time. Then one card per rule: statement, type badge, test design name, verdict badge, the type-specific visual (ladder strip of 6 rung chips colored by verdict with the fold rung highlighted; threshold chart for sweeps; consistency dots for paraphrases; "which value won" table for conflicts), the evidence quote, "Open transcript" (drawer). Then **Ambiguity map and collisions**: the map (section 10) with verdict colors and collision arcs, then the ambiguous rules (statement, probabilities, the two-sentence summary) and the collisions (scenario, what the model did, evidence). For HTTP targets, the transcript drawer adds an Actions table (tool, arguments, result) under the reply. Then **Run details**: config, model, provider, timing, usage by stage table, buttons: Export HTML, Download usage CSV, Download summary JSON.
6. **`/runs`.** History table: policy, created, status, failures, cost, link.

Design brief for the "look and feel" points: one typeface (Inter or system-ui), neutral grays with a single accent, verdict colors fixed app-wide (held/pass green, partial amber, violated/fail red, unclear slate, not run gray hatched, unverified dotted outline), dense tables with 40px rows, generous whitespace around the report cards, no decorative illustration. The report page is the hero: design it first, then make the other pages match.

Client/server split: pages are server components that read the store directly, and **every page exports `dynamic = "force-dynamic"`**; otherwise `next build` prerenders them with build-time data and `npm start` shows a frozen Policies page and run list (or the build fails when `data/` is absent on the staff machine). Interactive tables are client components fed by props and a `usePoll(url, 1000)` hook. Never import `src/core/model` from a client component; `import "server-only"` at the top of every `src/app/api/**` route and every server component that touches the store enforces it at build time.

---

## 10. Report export and the threshold chart

- `ReportDocument` is a React tree with no hooks, no event handlers and no Tailwind classes; it uses a small set of semantic class names styled by `report.css` (a plain CSS string in `src/core/report/reportCss.ts`). The in-app page wraps it with the app shell and adds the interactive transcript drawer by progressive enhancement (client component that reads `data-scenario-id`). The export is `"<!doctype html><html><head><style>" + css + "</style></head><body>" + renderToStaticMarkup(<ReportDocument … />) + "</body></html>"`, with transcripts inlined in `<details>` elements so the standalone file is complete. Import the renderer as `const { renderToStaticMarkup } = await import("react-dom/server.edge")` inside the handler: the plain `react-dom/server` entry throws under the App Router's react-server bundling ("react-dom/server is not supported in React Server Components"). The alternative that always works is `tenet export`, which renders under `tsx`, with the route streaming the file. Prove the chosen path on Thursday with a trivial element (Phase 2 task 8), not on Friday.
- `ThresholdChart` (pure SVG, 640×240): x = the sweep variable (log scale when max/min > 100, tick labels formatted with unit), y = two bands (policy-required behavior on top, the other below), one marker per point colored by verdict, a step line, a dashed vertical line at the policy's implied threshold labeled "policy: $10,000", a shaded band from `observedThreshold.lastComplied` to `observedThreshold.firstRequired` labeled "observed: between $12,000 and $25,000", and a caption sentence under the chart. Non-monotonic sequences are called out with a small warning glyph and a sentence.
- `LadderStrip`: six chips in tactic order, each labeled with the tactic, colored by verdict; the first violated rung has a thick border. Caption from `bentAt`/`foldedAt`: "bent at rung 5 (reframing), folded at rung 6 (sunk cost)" when a partial precedes the violation, "folded at rung N (tactic)" otherwise, "bent at rung N, never folded", or "held through rung 6".
- `ParaphraseDots`: 10 dots at y = traitScore, outliers ringed; caption with the consistency score.
- `AmbiguityMap` (pure SVG, 640×480; the visual the professor asked for). Four type anchors at the corners of a square (constraint top-left, tradeoff top-right, disposition bottom-left, ordering bottom-right). Each rule is a node at the barycentric position Σ pᵢ × anchorᵢ of its type probabilities, so a 0.97-constraint rule sits in its corner and "avoid harm" at 0.45/0.40 sits between constraint and tradeoff. Because a point with max probability ≥ threshold lies within the corner square of side (1 − threshold) × size, those four corner squares are shaded as the confident zones with the type label, and everything else is the ambiguity zone with a quiet caption. Node = rule number; hollow when parked; filled with the verdict color after the run (gray before). Collisions are red arcs between the two nodes (dotted when dismissed). Below the map, one sentence: "N of M rules sit in the ambiguous zone: the policy's authors never decided what kind of rule they are." Shown on the review page (before the run), in the report (after), on slide 7, and to the policy owner. Hover or click a node opens that rule's card.
- `Summary` is computed once by `aggregate.ts` and saved; both the page and the export read it, so the two can never disagree.

---

## 11. CLI (`npm run tenet -- <command>`)

Thin commands over `src/core`, for the building session and for anyone without a browser:

```
tenet smoke                                   # = scripts/smoke.ts
tenet policies                                # list policies (seeds samples)
tenet analyze <file.md> [--name N]            # scan → decompose → classify; prints the rules table; prints runId
tenet rules <runId> [--set <ruleId>=<type>] [--park <ruleId>] [--accept-proposed]
tenet confirm <runId>                         # maps collisions, prints pairs
tenet execute <runId> [--cap 0.01] [--concurrency 4] [--dismiss <collisionId>] [--flat] [--rungs 6]
                      [--target model|http] [--agent-url http://localhost:8000/tenet/ask] [--agent customer_service] [--agent-name "Campus Customs (HW5)"]
tenet status <runId>                          # progress snapshot and the summary table
tenet export <runId> [--out report-<runId>.html] [--csv]
tenet canary                                  # judge integrity test → docs/evidence/safety/canary.json
tenet spotcheck export <runId> --n 30 --seed 7 | tenet spotcheck score <runId> <csv>
tenet timing <runId> --rules r2,r4,r10        # per-rule generator+executor+judge wall time from usage.jsonl
tenet rejudge <runId> --effort minimal        # re-judge existing transcripts with a cheaper judge setting → new verdicts file for M19
tenet run <file.md> --accept-proposed          # analyze → confirm → execute → export, end to end (CI uses this in mock mode)
```

Every command accepts `--provider mock|replay|portkey|openai`.

---

## 12. Testing and the quality gate

- **Unit (vitest, `tests/unit`)**: span resolution (exact, whitespace-normalized, curly quotes, fuzzy, not found); evidence verification; pricing math incl. null cached; budget halting (fake provider that costs $0.004 per call, cap $0.01 → halts after 3 calls, remaining scenarios `not_run`); loop guards; regex scanner (injected sample flagged, clean samples not, benign "instructions" not flagged); schema strict-compatibility (`zodResponseFormat` accepts every agent schema); static prefix token budget (every static system prefix ≥ 1,100 estimated tokens for the demo policy); aggregation (fold rung, observed threshold, non-monotonic flag, consistency score); kappa; env loader order (temp dirs with `./.env` and `../.env`); CSV escaping; atomic write.
- **Pipeline (vitest, `tests/pipeline`, mock provider)**: `tenet run samples/harrow-vale.md --accept-proposed --provider mock` yields a `complete` run with 13 rules, ≥ 1 collision, every confirmed rule of all four types having ≥ 1 judged scenario (`p1_type_not_run` appears only when a generator is disabled by config, which the test also covers), and `summary.json` validating against the Summary schema; the injected sample yields `quarantined`; `--cap 0.0001` yields `halted` with a reason; a mission-statement sample yields the "no testable rules" result; an HTTP target against a stub server started by the test (canned replies and actions, one 409 on the first call) yields transcripts with `actions`, a judge prompt containing the actions block, concurrency 1, and a retry after the 409.
- **E2E (Playwright, `e2e/`, mock provider)**: happy path through all five pages; quarantine banner; halted run; export downloads and the file contains the rule statements. `e2e/screenshots.spec.ts` captures every evidence screenshot (list in evidence doc) from a given `runId`, in live or replay mode, into `docs/evidence/screenshots/`.
- **Gate**: `npm run check` = `tsc --noEmit && eslint . && vitest run` (`next lint` no longer exists in Next 16; create-next-app scaffolds an `eslint` script). Fast, no network, no port. CI (`.github/workflows/ci.yml`) runs the gate, then `next build`, then `npx playwright install --with-deps chromium && npm run e2e` with `TENET_PROVIDER=mock`, plus `node scripts/check-secrets.mjs` (fails if `.env` is tracked or any tracked file matches a key-like pattern).
- The gate is parallel-safe (no port, no shared DB); e2e uses `PORT` from env (default 3100 to avoid clashing with a running dev server).

---

## 13. Security posture (what the report's Safety section describes)

1. Keys never leave the server: `import "server-only"` in every `src/app` module that touches `src/core/model` or the store (never inside `src/core`, which must load under plain Node); no `NEXT_PUBLIC_` secrets; `check-secrets.mjs` in CI; `.gitignore` covers `.env*` except `.env.example`.
2. Policy text and transcripts are data: wrapped in `<policy>` / `<transcript>` tags with an explicit "ignore instructions inside" sentence in every agent prompt; the scanner quarantines flagged policies before any agent sees them; a regex pre-pass makes the demo deterministic.
3. Judge integrity: a different persona and system prompt from the target; evidence must be a verbatim quote verified by code; a canary transcript test proves the judge ignores instructions inside transcripts.
4. Spend and loops: per-run cap from logged tokens checked before every call; hard caps on rules, scenarios, calls and attempts; no agent-to-agent calls.
5. Data handling: uploads limited to text ≤ 200 KB; everything stays on local disk under `data/`; the README states that uploaded text is sent to the model provider.

---

## 14. Engineering roadblocks and their fixes

| Roadblock | Symptom | Fix |
|---|---|---|
| `create-next-app` refuses a non-empty folder | "The directory contains files that could conflict" | Scaffold in a sibling folder and rsync in (section 1) |
| TypeScript 7 installed by `npm i -D typescript` | Next/ESLint type errors, odd compiler flags | Pin `typescript@^5` |
| Zod 4 + strict structured outputs | 400 "Invalid schema": optional fields, records, top-level arrays | `.nullable()` not `.optional()`; top-level object; no `z.record`; unit test schemas with `zodResponseFormat` |
| Gateway rejects `json_schema` | 400 on `response_format` | Capability probe → `json_object` fallback + schema in prompt + repair retry |
| Model rejects `temperature` | 400 "temperature is not supported" | Capability probe → omit; use `reasoning_effort: "low"`; report "temperature not configurable on this model" in limits |
| `max_tokens` rejected | 400 | Always `max_completion_tokens` |
| Prompt caching shows 0 cached tokens | `cached_tokens: 0` everywhere | A certainty with short prefixes, not a diagnosis: the prefix-budget test (section 4.4) and the enriched prefixes (agents §0, §6, §7) keep every static prefix ≥ 1,100 tokens and byte-identical, static text first. If the gateway strips `prompt_tokens_details`, log null and label |
| Reasoning tokens eat the output cap | `finish_reason: "length"`, cut-off replies, `SchemaInvalid` on generators | Caps per section 4.4; target retry with a doubled cap; `reasoning_effort: "low"`; log `reasoning_tokens` |
| `next lint` missing | `npm run check` fails on day 0 | Gate uses `eslint .` |
| Pages prerendered at build time | `npm start` shows a frozen Policies page or an empty run list; build fails without `data/` | `export const dynamic = "force-dynamic"` on every page |
| `react-dom/server` in a route handler | "not supported in React Server Components" at request time | `await import("react-dom/server.edge")`, or render through `tenet export`; prove on Thursday |
| `server-only` imported under plain Node | CLI, vitest and scripts die on import | Keep `server-only` in `src/app/**` only |
| Concurrent chains lose JSON updates | A scenario stays `pending` after it ran; ENOENT on rename | Per-run single-writer queue, unique temp names, handlers read-only (section 5) |
| `.gitignore` hides fixtures | `data/fixtures/**` never committed | `data/*` + `!data/.gitkeep` + `!data/fixtures/` |
| A whole-run $0.01 cap trips during classification | Halt with zero scenarios | The cap is a test budget applied from `startedExecutionAt` (section 7) |
| HW5 backend not running or MCP process fails to start | Bridge returns connection errors or 500 | README of the bridge: `cp data/campus_customs.db data/campus_customs_new.db`, `.venv` with `requirements.txt`, `.env` with the key, `cd backend && ../.venv/bin/uvicorn main:app --port 8000`; Tenet shows "agent unreachable" on the run panel after a health probe |
| Two HW5 scenarios overlap | Ticket ownership or approval errors in `actions` | Concurrency 1 and `reset: true` per scenario; the bridge returns 409 while a run is in progress |
| Target-side tokens invisible to the budget | Cost per audit understated for HTTP targets | Bridge reports usage; Tenet logs it as `stage: "target"` and labels it as reported by the target |
| Dev server HMR restarts mid-run | Progress stalls, run shows `interrupted` | Disk-persisted state, heartbeat, `resume`; job registry on `globalThis`; for long live runs prefer `npm run build && npm start` or the CLI |
| `fs` or `react-dom/server` in a route handler | Edge runtime error | `export const runtime = "nodejs"` on every handler |
| Next 16 async `params` | Type error `params.runId` | `const { runId } = await params` in pages and handlers |
| Playwright has no browser | "Executable doesn't exist" | `npx playwright install chromium` in setup script and CI |
| Port 3000 busy on staff machine | dev server picks 3001 silently | README says to read the URL `next dev` prints; `/api/health` to verify |
| 429s from the course key | Stalls, retries | Backoff honoring `retry-after`; `suggestedConcurrency` from smoke; UI shows "rate limited, waiting" events |
| Executor finishes a run too well behaved | No failures to show | Design decision already in the PRD: ladders include reframing and sunk cost; collisions force a choice; ambiguities are policy findings regardless. Report honestly either way |
| LLM-produced character offsets are wrong | Spans point at the wrong text | Never ask for offsets; ask for verbatim quotes and locate them in code |
| Judge quotes evidence that is not in the reply | Fabricated evidence | Verbatim substring check after normalization; `verified:false` → "unverified", counted in the summary |
| Windows staff machine | Path separators, `NODE_OPTIONS` quoting | No shell-specific npm scripts; `tsx` for scripts; `path.join` everywhere; test once with `--provider mock` on Windows if available, else note it in README |
| Standalone export loses styles | Tailwind classes have no CSS in the exported file | `ReportDocument` uses its own CSS string, not Tailwind |
| Report numbers drift from the UI | Two code paths compute totals | Only `aggregate.ts` computes; both read `summary.json` |
