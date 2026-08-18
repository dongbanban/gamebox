import { defineConfig, devices } from "@playwright/test";

const crossBrowserEnabled = process.env.PLAYWRIGHT_CROSS_BROWSER === "1";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(crossBrowserEnabled
      ? [
          {
            name: "safari",
            testMatch: /cross-browser\.spec\.ts/,
            use: { ...devices["Desktop Safari"] },
          },
          {
            name: "mobile-chromium",
            testMatch: /cross-browser\.spec\.ts/,
            use: { ...devices["Pixel 5"] },
          },
        ]
      : []),
  ],
});
