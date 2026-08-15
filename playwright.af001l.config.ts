import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/hardware",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: false,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },
  projects: [
    {
      name: "target-hardware-chromium",
      use: {
        ...devices["Desktop Chrome"],
        headless: false,
        launchOptions: {
          args: ["--enable-gpu", "--ignore-gpu-blocklist"]
        }
      }
    }
  ],
  webServer: {
    command: "npm run start --workspace @tehkne/studio-web -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1"
    }
  }
});
