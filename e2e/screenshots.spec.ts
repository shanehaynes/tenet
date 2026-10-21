import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

// Captures the report's evidence screenshots (S01–S14, S19) from one live run of the demo policy driven
// through the UI, plus S07 from a run halted by a $0.01 test budget. Writes the run ids next to the images.

const OUT = path.join(__dirname, "..", "docs", "evidence", "screenshots");
mkdirSync(OUT, { recursive: true });
const shot = (name: string) => path.join(OUT, `${name}.png`);

async function waitForStatus(request: APIRequestContext, runId: string, statuses: string[], timeout = 180_000) {
  await expect
    .poll(async () => (await (await request.get(`/api/runs/${runId}`)).json()).run.status, { timeout, intervals: [1000] })
    .toMatch(new RegExp(`^(${statuses.join("|")})$`));
}

/** Screenshot of the page region spanning two elements (inclusive). */
async function shotBetween(page: Page, first: Locator, last: Locator, file: string) {
  await first.scrollIntoViewIfNeeded();
  const a = await first.boundingBox();
  const b = await last.boundingBox();
  if (!a || !b) throw new Error("element not visible");
  const scrollY = await page.evaluate(() => window.scrollY);
  const top = a.y + scrollY - 12;
  const bottom = b.y + scrollY + b.height + 12;
  await page.screenshot({ path: file, fullPage: true, clip: { x: Math.min(a.x, b.x) - 12, y: top, width: Math.max(a.width, b.width) + 24, height: bottom - top } });
}


/** S08–S14 from a finished run: the report sections, the transcript drawer and the exported file. */
async function reportShots(page: Page, request: APIRequestContext, runId: string) {
  await page.goto(`/runs/${runId}/report`);
  await expect(page.getByTestId("run-header")).toContainText(/Complete|Halted/);
  await page.locator(".tr-strip").screenshot({ path: shot("S08-summary-strip") });
  await page.locator("#rule-r10").screenshot({ path: shot("S10-threshold-chart") });
  await page.locator("#rule-r2").screenshot({ path: shot("S09a-ladder") });
  await page.locator("#rule-r2").getByRole("button", { name: /Open transcript/ }).click();
  await expect(page.getByTestId("transcript-drawer")).toContainText("Judge", { timeout: 15_000 });
  await page.waitForTimeout(700); // let the drawer finish its slide-in
  await page.screenshot({ path: shot("S09b-transcript") });
  await page.keyboard.press("Escape");

  const defects = page.locator(".tr-defect");
  const collision = page.locator(".tr-defect", { hasText: "Collision:" }).first();
  if (await collision.count()) await collision.screenshot({ path: shot("S11-collision") });
  const ambiguous = page.locator(".tr-defect", { hasText: "Ambiguous:" });
  if (await ambiguous.count()) await shotBetween(page, page.getByRole("heading", { name: "Policy defects" }), ambiguous.last(), shot("S12-policy-defects"));
  await shotBetween(page, page.getByRole("heading", { name: "Usage by stage" }), page.locator(".tr-num").last(), shot("S13-usage"));
  expect(await defects.count()).toBeGreaterThan(0);

  const html = await (await request.get(`/api/runs/${runId}/report.html`)).text();
  const exported = path.join(OUT, "..", "runs", runId, "report.html");
  mkdirSync(path.dirname(exported), { recursive: true });
  writeFileSync(exported, html);
  await page.goto(`file://${exported}`);
  await page.screenshot({ path: shot("S14-exported-report") });

}

test("report screenshots from an existing run (RUN_ID)", async ({ page, request }) => {
  test.skip(!process.env.RUN_ID, "set RUN_ID to re-capture S08–S14 from an existing run");
  await reportShots(page, request, process.env.RUN_ID!);
});

test("evidence screenshots from a live demo run", async ({ page, request }) => {
  test.skip(Boolean(process.env.RUN_ID), "RUN_ID set: only the report screenshots are re-captured");
  const runs: Record<string, string> = {};

  await page.goto("/");
  await expect(page.getByTestId("sample-harrow-vale")).toBeVisible({ timeout: 120_000 });
  await page.screenshot({ path: shot("S01-policies") });
  await page.getByTestId("safety-demo").screenshot({ path: shot("S02-quarantine") });

  await page.getByTestId("sample-harrow-vale").getByRole("button", { name: "Analyze" }).click();
  await page.waitForURL(/\/runs\/\w+\/review/);
  const runId = page.url().split("/runs/")[1].split("/")[0];
  runs.demoRunId = runId;
  await waitForStatus(request, runId, ["awaiting_review"]);
  await page.reload();
  await expect(page.getByTestId("confirm-rules")).toBeVisible();
  await page.screenshot({ path: shot("S03-review"), fullPage: true });
  await page.locator(".tr-map").screenshot({ path: shot("S19-ambiguity-map") });

  // The demo script's overrides (PRD): rule 5 to ordering if the classifier left it open, rule 13 parked.
  const rule5 = page.getByLabel("Type for rule 5");
  if ((await rule5.inputValue()) === "") await rule5.selectOption("ordering");
  const park13 = page.getByLabel("Park rule 13");
  if (!(await park13.isChecked())) await park13.check();
  await expect(page.getByTestId("confirm-rules")).toBeEnabled({ timeout: 15_000 });
  await page.getByTestId("rule-row-r1").scrollIntoViewIfNeeded();
  await page.screenshot({ path: shot("S04-overrides") });

  await page.getByTestId("confirm-rules").click();
  await page.waitForURL(/\/collisions$/, { timeout: 120_000 });
  await waitForStatus(request, runId, ["awaiting_collision_review"]);
  await page.reload();
  await page.getByLabel("Concurrency").fill("6");
  await page.screenshot({ path: shot("S05-collisions") });

  await page.getByTestId("run-tests").click();
  await page.waitForURL(/\/report$/);
  await expect
    .poll(async () => (await (await request.get(`/api/runs/${runId}`)).json()).progress.judged, { timeout: 180_000, intervals: [500] })
    .toBeGreaterThan(12);
  await page.screenshot({ path: shot("S06-progress") });

  await waitForStatus(request, runId, ["complete", "halted", "failed"], 600_000);
  await reportShots(page, request, runId);

  // S07: the same policy against a $0.01 test budget.
  const policies = await (await request.get("/api/policies")).json();
  const harrow = policies.find((p: { sample: { key: string } | null }) => p.sample?.key === "harrow-vale");
  const halted = await (await request.post("/api/runs", { data: { policyId: harrow.id } })).json();
  runs.haltedRunId = halted.id;
  await waitForStatus(request, halted.id, ["awaiting_review"]);
  await request.post(`/api/runs/${halted.id}/confirm`);
  await waitForStatus(request, halted.id, ["awaiting_collision_review"]);
  await request.post(`/api/runs/${halted.id}/execute`, { data: { spendCapUsd: 0.01, concurrency: 6 } });
  await waitForStatus(request, halted.id, ["halted", "complete"], 300_000);
  await page.goto(`/runs/${halted.id}/report`);
  await expect(page.getByTestId("run-header")).toBeVisible();
  await page.screenshot({ path: shot("S07-halted") });

  writeFileSync(path.join(OUT, "runs.json"), `${JSON.stringify({ capturedAt: new Date().toISOString(), ...runs }, null, 2)}\n`);
});
