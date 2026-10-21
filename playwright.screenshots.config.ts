import { defineConfig, devices } from "@playwright/test";

// Evidence screenshots (docs/plan/evidence-report-slides.md §1.1): a live run through the real UI against a
// production build with the real key and the default data folder, so the demo run is kept.
// Run with: npm run build && npm run screenshots
const port = Number(process.env.SHOTS_PORT ?? 3300);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "screenshots.spec.ts",
  timeout: 15 * 60_000,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${port}`, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } }],
  webServer: { command: `npx next start -p ${port}`, url: `http://localhost:${port}/api/health`, reuseExistingServer: false, timeout: 120_000 },
});
