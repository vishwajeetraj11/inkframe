import { defineConfig } from "@playwright/test";

const port = Number(process.env.INKFRAME_E2E_PORT ?? 3100);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("INKFRAME_E2E_PORT must be an integer between 1 and 65535.");
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL,
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
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/editor`,
    timeout: 120_000,
    reuseExistingServer: true,
  },
});
