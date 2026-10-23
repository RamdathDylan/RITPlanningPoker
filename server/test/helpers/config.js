import { loadConfig } from "../../src/config.js";

export function testConfig(overrides = {}) {
  return loadConfig({
    NODE_ENV: "test",
    CLIENT_ORIGIN: "http://localhost:5173",
    DATABASE_URL: "postgres://pp_app:placeholder@localhost:5432/planning_poker_test",
    ...overrides,
  });
}
