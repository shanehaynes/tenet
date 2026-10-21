import { rmSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// e2e runs against a production build in mock mode on its own port and its own data folder, so it never
// clashes with a dev server or touches data/.
const port = Number(process.env.PORT ?? 3100);
const dataDir = path.join(__dirname, "test-results", "e2e-data");
if (!process.env.TEST_WORKER_INDEX) rmSync(dataDir, { recursive: true, force: true });

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/screenshots.spec.ts"],
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx next start -p ${port}`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { TENET_PROVIDER: "mock", TENET_DATA_DIR: dataDir },
  },
});
