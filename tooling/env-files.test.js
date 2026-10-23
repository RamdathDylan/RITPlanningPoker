import { describe, expect, it } from "vitest";
import { findForbiddenEnvFiles } from "./env-files.js";

describe("findForbiddenEnvFiles", () => {
  it("flags a root .env file", () => {
    expect(findForbiddenEnvFiles([".env", "package.json"])).toEqual([".env"]);
  });

  it("flags nested and suffixed env files", () => {
    const tracked = ["server/.env", ".env.production", "client/.env.local"];
    expect(findForbiddenEnvFiles(tracked)).toEqual(tracked);
  });

  it("allows .env.example anywhere", () => {
    expect(findForbiddenEnvFiles([".env.example", "server/.env.example"])).toEqual([]);
  });

  it("ignores files that only contain 'env' in their name", () => {
    expect(findForbiddenEnvFiles(["server/src/env.js", "docs/environment.md"])).toEqual([]);
  });
});
