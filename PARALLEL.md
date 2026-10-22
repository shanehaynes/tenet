# Parallel work: shared state

Inventory for running several agents at once (written 2026-10-22). Every item has exactly one treatment.

| Shared state | Treatment | Rule |
|---|---|---|
| Primary checkout `~/projects/Tenet` (branch `main`) | Orchestrator-owned | Lanes never build or commit here; the orchestrator merges. |
| Lane worktrees | Partition | `~/projects/Tenet-lanes/<slug>`, one branch each, outside the repo. Inside the repo, `tsc` and `eslint .` would scan them. Nothing above the lane folder holds a `.env`, so a lane can only run with the mock provider. |
| `node_modules`, `.next`, `data/`, `test-results/` | Partition | Per worktree; `npm ci` once per lane. |
| Ports | Partition | e2e uses 3100 and screenshots 3300 in the primary; a lane uses its own port (3201 and up) and stops only its own PID. |
| The course key, live model calls, `data/usage-global.jsonl` | Orchestrator-owned | $40 budget. No live call from a lane. |
| HW5 backend on :8000 and its working copies | Orchestrator-owned | One agent run at a time (the bridge enforces it). |
| Gate-protected paths: `tests/**` (existing files), `e2e/**`, `vitest.config.mts`, `playwright*.config.ts`, `eslint.config.mjs`, `tsconfig.json`, `.github/**`, `package.json`, `package-lock.json` | Orchestrator-owned | A lane may add a new test file for its own new code; it never edits an existing test or config. |
| Hot files: `STATUS.md`, `README.md`, `CLAUDE.md`, `docs/evidence/**`, `docs/decisions/**`, `report/**`, `slides/**`, `report.html`, `slides.html` | Orchestrator-owned | Lanes report; the orchestrator edits. |
| Spot-check blindness | Orchestrator-owned | Until Shane has scored `docs/evidence/spotcheck/449NHijnXq-blank.csv`, nothing written for Shane to read may state the verdicts of run `449NHijnXq`. |
