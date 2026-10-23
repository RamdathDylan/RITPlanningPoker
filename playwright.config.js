import { defineConfig, devices } from "@playwright/test";

// Load .env for local runs (database URLs). CI sets the variables directly instead.
try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
}

const clientPort = 4173;
const serverPort = 3100;
const clientOrigin = `http://localhost:${clientPort}`;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.js",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: clientOrigin,
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
  webServer: [
    {
      // The real API + Socket.IO server, using the test database as the app role.
      command: "npm run start -w server",
      url: `http://localhost:${serverPort}/health`,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: "test",
        PORT: String(serverPort),
        CLIENT_ORIGIN: clientOrigin,
        DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
        // E2E runs create many rooms from one machine.
        RATE_LIMIT_ROOM_CREATES_PER_10_MIN: "1000",
        RATE_LIMIT_JOINS_PER_MIN: "1000",
      },
    },
    {
      // Until the server serves the built client (roadmap 11.1), Vite's preview server hosts it
      // and proxies /api, /health, and /socket.io to the server above (client/vite.config.js).
      command: `npm run build -w client && npm run preview -w client -- --port ${clientPort} --strictPort`,
      url: clientOrigin,
      reuseExistingServer: !process.env.CI,
      env: { PORT: String(serverPort) },
    },
  ],
});
