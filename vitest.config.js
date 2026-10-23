import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Load .env for local runs (database URLs). CI sets the variables directly instead.
try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
}

const strict = { lines: 90, functions: 90, branches: 90, statements: 90 };

export default defineConfig({
  test: {
    // Coverage is a check, not a goal (CLAUDE.md): it flags untested areas.
    coverage: {
      provider: "v8",
      include: ["server/src/**/*.js", "shared/**/*.js", "client/src/**/*.{js,jsx}"],
      exclude: [
        "**/*.test.{js,jsx}",
        // Entry points that only wire things together; covered by E2E and smoke runs.
        "server/src/index.js",
        "server/src/db/migrate-cli.js",
        "client/src/main.jsx",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        "server/src/rooms/**": strict,
        "server/src/middleware/**": strict,
      },
    },
    projects: [
      {
        test: {
          name: "tooling",
          include: ["tooling/**/*.test.js"],
          environment: "node",
        },
      },
      {
        test: {
          name: "shared",
          include: ["shared/**/*.test.js"],
          environment: "node",
        },
      },
      {
        test: {
          name: "server",
          include: ["server/**/*.test.js"],
          environment: "node",
          // Database tests share one Postgres; running files one at a time keeps them predictable.
          fileParallelism: false,
        },
      },
      {
        plugins: [react()],
        test: {
          name: "client",
          include: ["client/**/*.test.{js,jsx}"],
          environment: "jsdom",
          setupFiles: ["client/test/setup.js"],
        },
      },
    ],
  },
});
