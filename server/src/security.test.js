import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { testConfig } from "../test/helpers/config.js";
import { createFakeLogger } from "../test/helpers/fake-logger.js";
import { createApp } from "./app.js";

const allowedOrigin = "http://localhost:5173";

const testCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join(";");

function probeRouter() {
  const router = express.Router();
  router.get("/ip", (req, res) => res.json({ ip: req.ip }));
  router.post("/echo", (req, res) => res.json({ received: req.body }));
  return router;
}

function buildApp(configOverrides = {}) {
  return createApp({
    config: testConfig(configOverrides),
    logger: createFakeLogger(),
    apiRouters: [probeRouter()],
  });
}

describe("security headers", () => {
  it("sets helmet's protective headers and hides X-Powered-By", async () => {
    const response = await request(buildApp()).get("/health");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["strict-transport-security"]).toMatch(/max-age=\d+/);
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("sends the exact Content-Security-Policy from the threat model", async () => {
    const response = await request(buildApp()).get("/health");

    expect(response.headers["content-security-policy"]).toBe(testCsp);
  });

  it("adds upgrade-insecure-requests to the policy in production", async () => {
    const app = buildApp({ NODE_ENV: "production", CLIENT_ORIGIN: "https://poker.example" });
    const response = await request(app).get("/health");

    expect(response.headers["content-security-policy"]).toBe(
      `${testCsp};upgrade-insecure-requests`,
    );
  });
});

describe("CORS", () => {
  it("allows the configured client origin", async () => {
    const response = await request(buildApp()).get("/health").set("Origin", allowedOrigin);

    expect(response.headers["access-control-allow-origin"]).toBe(allowedOrigin);
  });

  it("answers a preflight request from the configured origin", async () => {
    const response = await request(buildApp())
      .options("/api/echo")
      .set("Origin", allowedOrigin)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(allowedOrigin);
  });

  it("does not allow any other origin", async () => {
    const response = await request(buildApp()).get("/health").set("Origin", "https://evil.example");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("request bodies", () => {
  it("accepts a JSON body under 10 KB", async () => {
    const response = await request(buildApp())
      .post("/api/echo")
      .send({ text: "a".repeat(9 * 1024) });

    expect(response.status).toBe(200);
    expect(response.body.received.text).toHaveLength(9 * 1024);
  });

  it("rejects a JSON body over 10 KB with a generic 413", async () => {
    const response = await request(buildApp())
      .post("/api/echo")
      .send({ text: "a".repeat(11 * 1024) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: "Request too large" });
  });

  it("rejects malformed JSON with a generic 400", async () => {
    const response = await request(buildApp())
      .post("/api/echo")
      .set("Content-Type", "application/json")
      .send('{"text": ');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Bad request" });
  });
});

describe("trust proxy", () => {
  it("uses the client address added by the one trusted proxy", async () => {
    const response = await request(buildApp()).get("/api/ip").set("X-Forwarded-For", "203.0.113.9");

    expect(response.body.ip).toBe("203.0.113.9");
  });

  it("ignores extra addresses a client puts in front of the header", async () => {
    const response = await request(buildApp())
      .get("/api/ip")
      .set("X-Forwarded-For", "198.51.100.1, 203.0.113.9");

    expect(response.body.ip).toBe("203.0.113.9");
  });
});
