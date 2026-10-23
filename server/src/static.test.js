import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { testConfig } from "../test/helpers/config.js";
import { createFakeLogger } from "../test/helpers/fake-logger.js";
import { createApp } from "./app.js";

const clientDist = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../test/fixtures/client-dist",
);

const buildApp = (options = {}) =>
  createApp({ config: testConfig(), logger: createFakeLogger(), clientDist, ...options });

describe("serving the built client", () => {
  it("serves index.html at the root", async () => {
    const response = await request(buildApp()).get("/");
    expect(response.status).toBe(200);
    expect(response.text).toContain("<title>Planning Poker</title>");
  });

  it("serves index.html for client-side routes so links like /room/CODE work", async () => {
    for (const route of ["/room/ABCDEFGH", "/join/ABCDEFGH", "/privacy", "/no/such/page"]) {
      const response = await request(buildApp()).get(route);
      expect(response.status, route).toBe(200);
      expect(response.headers["content-type"]).toMatch(/text\/html/);
      expect(response.headers["cache-control"]).toBe("no-cache");
    }
  });

  it("serves built assets with long-lived caching (their names change on every build)", async () => {
    const response = await request(buildApp()).get("/assets/index-abc123.js");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  it("returns 404 for a missing asset instead of the app page", async () => {
    expect((await request(buildApp()).get("/assets/missing.js")).status).toBe(404);
  });

  it("keeps API and health responses as JSON", async () => {
    const app = buildApp();
    expect((await request(app).get("/api/unknown")).body).toEqual({ error: "Not found" });
    expect((await request(app).get("/health")).body).toEqual({ status: "ok" });
  });

  it("doesn't serve the client when no build directory is configured", async () => {
    const response = await request(buildApp({ clientDist: undefined })).get("/room/ABCDEFGH");
    expect(response.status).toBe(404);
  });
});
