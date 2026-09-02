import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-webgl", "--enable-features=WebMCP"],
    },
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/editor",
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
