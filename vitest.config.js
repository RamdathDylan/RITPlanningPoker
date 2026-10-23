import { defineConfig } from "vitest/config";

// Load .env for local runs (database URLs). CI sets the variables directly instead.
try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
}

export default defineConfig({
  test: {
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
          name: "server",
          include: ["server/**/*.test.js"],
          environment: "node",
          // Database tests share one Postgres; running files one at a time keeps them predictable.
          fileParallelism: false,
        },
      },
    ],
  },
});
