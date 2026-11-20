import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: process.env.APP_ORIGIN || "http://localhost:3000",
    browserName: "chromium",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/local/bin/chromium",
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["json", { outputFile: "docs/e2e-results.json" }]],
});
