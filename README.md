# Tenet

Tenet reads an AI agent's written policy, sorts each rule by kind (constraint, tradeoff, disposition, ordering), and runs the test each kind calls for: a pressure ladder for a constraint, a stakes sweep for a tradeoff, paraphrases for a disposition, forced conflicts for an ordering. It reports where the agent's behavior departs from the policy, and where the policy is ambiguous or contradicts itself.

> Work in progress (MGT 409 final project, due 2026-10-26). This README is a skeleton; the full 10-minute run path lands on Friday Oct 23.

## Run it locally

1. Node 22.12 or newer (`node -v`) and git.
2. `git clone <repo-url> && cd tenet && npm install`
3. Create `.env` from `.env.example`, either in the repo folder or one folder above it, and set `PORTKEY_API_KEY` (the course key) or `OPENAI_API_KEY`.
4. `npm run doctor` shows which `.env` it found, which key is present, and which provider it will use.
5. `npm run dev` and open the URL it prints.

No key? Add `--provider mock` to any CLI command (or set `TENET_PROVIDER=mock`) for deterministic offline results.

## Development

```bash
npm run check                         # typecheck + lint + unit tests (no network)
npm run tenet -- policies --provider mock
npm run smoke                         # probe the model gateway; needs a key
```

## Safety and privacy

Text you paste is sent to the model provider through the configured gateway. Everything else stays under `data/` on your disk. Each run has a test budget, every model call is logged, and the cumulative spend on the key is capped (`TENET_KEY_BUDGET_USD`, default $40).

## Project documents

`PLAN.md` (plan), `STATUS.md` (where things stand), `docs/PRD.md` (requirements), `docs/plan/` (design).
