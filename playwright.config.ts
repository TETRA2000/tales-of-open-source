import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://127.0.0.1:4322" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: "pnpm build && pnpm astro preview --port 4322 --host 127.0.0.1 --ignore-lock",
    url: "http://127.0.0.1:4322/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
