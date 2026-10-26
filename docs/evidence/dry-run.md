# Fresh-clone dry run (M17, 2026-10-26)

**Result: pass. 3 min 29 s from the start of the clone to the finished report**, against a target of under 10 minutes.

**Who and where.** A Claude Code session ran this on Shane's Linux machine, the same machine the project was built on. The plan called for Shane to run it on a second machine; this is not a second-machine run. The session followed the README's "Run it locally" section word for word, took a `date +%s` timestamp at each step, and drove step 6 in a headless browser instead of clicking by hand.

| | |
|---|---|
| Repository | https://github.com/shanehaynes/tenet (public), cloned at `2b2371476cc25717c94d44ca101af74523abc56b` |
| Folder | `/home/shanehaynes/projects/tenet-dryrun`, new; its parent holds the course key in `.env` |
| Machine | Linux 6.18, Node 22.23.1, git 2.43.0, warm npm cache |
| Run | `BxVjTQ1vuz`, Harrow & Vale LLP, provider portkey, model gpt-6-luna |
| Report | Complete: 13 rules (10 tested, 3 parked for low confidence), 63 scenarios, 63 judged, 0 not run; test spend $0.0184 of $2.00, analysis $0.0023; 118 s |

## Stopwatch

Times are EDT. Seconds come from `date +%s` taken before and after each step (step 6 from timestamps in the browser driver).

| README step | Start | Seconds | What happened |
|---|---|---:|---|
| 1. Prerequisites (`node -v`) | 14:56:50 | 0 | v22.23.1 (README asks for 22.12 or newer); git 2.43.0 |
| 2. Clone and `npm install` | 14:56:56 | 6 | Clone 1 s; install 5 s, 649 packages. The npm cache was warm, so a first install on a new machine will take longer. |
| 3. Key | 14:57:08 | 0 | Skipped. A `.env` with `PORTKEY_API_KEY` already sits one folder up, which the README allows ("in the repo folder or in the folder above it"), so nothing was copied. |
| 4. `npm run doctor` | 14:57:08 | 9 | Found `/home/shanehaynes/projects/.env`; key present (masked); provider portkey, model gpt-6-luna; "Model call ok in 9078 ms". |
| 5. `npm run dev` | 14:57:25 | 5 | "Port 3000 is in use by an unknown process, using available port 3001 instead." Ready in 353 ms. The 5 s includes the session's wait for the ready line. |
| 6a. Open the URL, home page loads | 14:57:39 | 18 | First page compile in dev mode, plus the injection scanner's model check on the six samples (6 calls). |
| 6b. **Analyze** on Harrow & Vale, until the rules table appears | 14:57:57 | 6 | |
| 6c. Classification finishes, **Confirm** is enabled | 14:58:03 | 13 | 13 rules; 3 pre-parked for low confidence. Types left as proposed. |
| 6d. **Confirm**, until the collisions page is ready | 14:58:16 | 9 | No collisions found on this run. |
| 6e. **Run tests**, until the report says Complete | 14:58:25 | 120 | The run header reports 118 s. |
| Gaps between steps | | 23 | The session's own time between commands inside the measured window. |
| **Total, start of clone to finished report** | 14:56:56 → 15:00:25 | **209** | **3:29**. From the `node -v` check: 3:35. |

A grader will be slower than this in two places: a cold `npm install`, and reading the rules table and the collisions page before clicking on (the headless driver clicked as soon as each button was enabled). Even a few minutes for each leaves the run well under 10 minutes.

## Cost and where the calls are logged

Every call from the dry run is logged in the clone's own `data/usage-global.jsonl` (`/home/shanehaynes/projects/tenet-dryrun/data/usage-global.jsonl`), not in the main checkout's log, which this run did not touch. That file holds 168 calls costing $0.0218:

- run `BxVjTQ1vuz`: 154 calls, $0.0208 (analysis $0.0023, tests $0.0184);
- `npm run doctor`: 8 probe calls, $0.00004 (the test call and the capability probes; two probes failed by design);
- the home page's injection scanner on the six samples: 6 calls, $0.0010.

So the report's cumulative spend on the key (M21, read from the main checkout's log) does not include these $0.0218. One live run was made; nothing failed, so there was no retry.

## Deviations from the README

- **Folder name.** The README's command clones into `tenet`. This run used `git clone https://github.com/shanehaynes/tenet.git tenet-dryrun && cd tenet-dryrun && npm install`, so the clone sits beside the main checkout under a name of its own. Nothing else in the command changed.
- **Step 3 skipped**, as above.
- **Step 6 headless.** A Playwright script (kept outside both repositories) opened the URL from step 5 and clicked Analyze, Confirm and Run tests. It used the Chromium already in `~/.cache/ms-playwright`; nothing was installed. A grader using an ordinary browser needs neither Playwright nor Chromium.

## README problems found

None that needed a fix; the README was not changed. Every step worked as written, including the troubleshooting note about a busy port 3000. Observations for the record, none fixed:

- **Cost wording.** The README says a full run "costs about three cents"; this run cost about two cents ($0.0208). It takes "about two minutes", which matched (118 s).
- **Install warnings.** `npm install` prints an eslint 9 deprecation warning and "1 high severity vulnerability": `body-parser` 2.3.0 (GHSA-27r3-jxmh-p828), pulled in through `shadcn` → `@modelcontextprotocol/sdk` → `express`. Tenet does not run that server, but a grader will see the warning. Not changed here; changing dependencies is outside a README fix.
- **Key budget per folder.** `npm run doctor` in the new clone reported "Key spend $0.0000 of $40 budget (0 billed calls)", because the key budget counts only the calls logged in that folder's `data/usage-global.jsonl`. A fresh clone does not see spend from other folders on the same key. The README's Safety section says the cumulative spend on the key is logged and capped, without saying it is counted per folder.
