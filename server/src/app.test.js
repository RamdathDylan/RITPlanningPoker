import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { testConfig } from "../test/helpers/config.js";
import { createFakeLogger } from "../test/helpers/fake-logger.js";
import { createApp } from "./app.js";

function failingRouter() {
  const router = express.Router();
  router.get("/explode", () => {
    throw new Error("secret internal detail");
  });
  router.get("/explode-async", async () => {
    throw new Error("secret async detail");
  });
  return router;
}

function buildApp() {
  const logger = createFakeLogger();
  const app = createApp({ config: testConfig(), logger, apiRouters: [failingRouter()] });
  return { app, logger };
}

describe("createApp", () => {
  it("answers GET /health with exactly { status: 'ok' }", async () => {
    const response = await request(buildApp().app).get("/health");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns a generic JSON 404 for unknown routes", async () => {
    const response = await request(buildApp().app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Not found" });
  });

  it.each(["/api/explode", "/api/explode-async"])(
    "returns a generic 500 without internal details when %s throws",
    async (path) => {
      const response = await request(buildApp().app).get(path);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: "Something went wrong" });
      expect(response.text).not.toMatch(/secret|stack|at /);
    },
  );

  it("logs the error details on the server", async () => {
    const { app, logger } = buildApp();
    await request(app).get("/api/explode");

    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0].level).toBe("error");
    expect(logger.entries[0].details.error.message).toBe("secret internal detail");
  });
});
