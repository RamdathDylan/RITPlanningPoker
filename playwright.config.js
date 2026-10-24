import { defineConfig, devices } from "@playwright/test";

// Load .env for local runs (database URLs). CI sets the variables directly instead.
try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
}

// One server, as in production: Express serves the built client (with its real security
// headers, including the Content-Security-Policy) plus the API and Socket.IO.
const port = 3100;
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: origin,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    // Migrate first, as a deploy does, so the server never starts on an empty database.
    command: "npm run migrate && npm run build -w client && npm run start -w server",
    url: `${origin}/health`,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: "test",
      PORT: String(port),
      CLIENT_ORIGIN: origin,
      CLIENT_DIST_DIR: "../client/dist",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      MIGRATION_DATABASE_URL: process.env.TEST_MIGRATION_DATABASE_URL ?? "",
      // E2E runs create many rooms from one machine.
      RATE_LIMIT_ROOM_CREATES_PER_10_MIN: "1000",
      RATE_LIMIT_JOINS_PER_MIN: "1000",
      // Two seconds instead of a minute, so the handoff test doesn't wait a minute.
      HANDOFF_MS: "2000",
    },
  },
});
