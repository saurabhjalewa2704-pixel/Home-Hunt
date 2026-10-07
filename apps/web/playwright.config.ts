import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Use a system Chromium when the matching Playwright build isn't installed.
const candidates = [process.env.PLAYWRIGHT_CHROMIUM_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].filter(Boolean) as string[];
const executablePath = candidates.find((p) => existsSync(p));

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3101", trace: "retain-on-failure" },
  projects: [
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 }, launchOptions: { executablePath } } },
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, launchOptions: { executablePath } }, grep: /@phone/ },
  ],
  webServer: { command: "npx next start -p 3101", url: "http://localhost:3101", reuseExistingServer: true, timeout: 60_000 },
});
