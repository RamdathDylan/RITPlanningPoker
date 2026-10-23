import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const validEnv = {
  CLIENT_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgres://pp_app:placeholder@localhost:5432/planning_poker",
};

function configErrorMessage(env) {
  try {
    loadConfig(env);
  } catch (error) {
    return error.message;
  }
  throw new Error("expected loadConfig to throw");
}

describe("loadConfig", () => {
  it("returns safe defaults for a minimal valid environment", () => {
    expect(loadConfig(validEnv)).toEqual({
      nodeEnv: "development",
      isProduction: false,
      port: 3000,
      clientOrigin: "http://localhost:5173",
      databaseUrl: validEnv.DATABASE_URL,
      databaseSsl: false,
      rateLimits: { roomCreatesPer10Minutes: 5, joinsPerMinute: 60, exportsPerMinute: 10 },
      maxLiveRooms: 200,
      handoffMs: 60_000,
    });
  });

  it("returns a frozen object so config can't change at runtime", () => {
    const config = loadConfig(validEnv);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.rateLimits)).toBe(true);
  });

  it("names a missing DATABASE_URL", () => {
    expect(configErrorMessage({ CLIENT_ORIGIN: validEnv.CLIENT_ORIGIN })).toContain("DATABASE_URL");
  });

  it("names a missing CLIENT_ORIGIN", () => {
    expect(configErrorMessage({ DATABASE_URL: validEnv.DATABASE_URL })).toContain("CLIENT_ORIGIN");
  });

  it("reports every invalid variable at once", () => {
    const message = configErrorMessage({ PORT: "abc" });
    expect(message).toContain("PORT");
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("CLIENT_ORIGIN");
  });

  it("never includes any variable's value in the error message", () => {
    const message = configErrorMessage({
      DATABASE_URL: "mysql://admin:hunter2-secret@db.example",
      CLIENT_ORIGIN: "ftp://private-host.example",
      PORT: "port-value-xyz",
    });
    expect(message).not.toContain("hunter2-secret");
    expect(message).not.toContain("private-host");
    expect(message).not.toContain("port-value-xyz");
  });

  it.each(["abc", "0", "65536", "3000.5", ""])("rejects PORT=%j", (port) => {
    expect(configErrorMessage({ ...validEnv, PORT: port })).toContain("PORT");
  });

  it("accepts a numeric PORT", () => {
    expect(loadConfig({ ...validEnv, PORT: "8080" }).port).toBe(8080);
  });

  it.each(["http://localhost:5173/app", "http://localhost:5173/?x=1", "not a url", "ws://x.y"])(
    "rejects CLIENT_ORIGIN=%j",
    (origin) => {
      expect(configErrorMessage({ ...validEnv, CLIENT_ORIGIN: origin })).toContain("CLIENT_ORIGIN");
    },
  );

  it("normalizes a CLIENT_ORIGIN with a trailing slash", () => {
    expect(loadConfig({ ...validEnv, CLIENT_ORIGIN: "https://poker.example/" }).clientOrigin).toBe(
      "https://poker.example",
    );
  });

  it("requires an https CLIENT_ORIGIN in production", () => {
    const message = configErrorMessage({ ...validEnv, NODE_ENV: "production" });
    expect(message).toContain("CLIENT_ORIGIN");
    const production = loadConfig({
      ...validEnv,
      NODE_ENV: "production",
      CLIENT_ORIGIN: "https://poker.example",
    });
    expect(production.isProduction).toBe(true);
  });

  it("rejects an unknown NODE_ENV", () => {
    expect(configErrorMessage({ ...validEnv, NODE_ENV: "staging" })).toContain("NODE_ENV");
  });

  it("rejects a DATABASE_URL that is not a Postgres URL", () => {
    expect(configErrorMessage({ ...validEnv, DATABASE_URL: "mysql://x@y/z" })).toContain(
      "DATABASE_URL",
    );
  });

  it.each([
    ["true", true],
    ["false", false],
  ])("parses DATABASE_SSL=%s", (value, expected) => {
    expect(loadConfig({ ...validEnv, DATABASE_SSL: value }).databaseSsl).toBe(expected);
  });

  it("rejects DATABASE_SSL values other than true or false", () => {
    expect(configErrorMessage({ ...validEnv, DATABASE_SSL: "yes" })).toContain("DATABASE_SSL");
  });

  it("reads rate limits, room cap, and handoff delay from the environment", () => {
    const config = loadConfig({
      ...validEnv,
      RATE_LIMIT_ROOM_CREATES_PER_10_MIN: "2",
      RATE_LIMIT_JOINS_PER_MIN: "120",
      RATE_LIMIT_EXPORTS_PER_MIN: "3",
      MAX_LIVE_ROOMS: "10",
      HANDOFF_MS: "200",
    });
    expect(config.rateLimits).toEqual({
      roomCreatesPer10Minutes: 2,
      joinsPerMinute: 120,
      exportsPerMinute: 3,
    });
    expect(config.maxLiveRooms).toBe(10);
    expect(config.handoffMs).toBe(200);
  });

  it.each(["0", "-1", "1.5", "many"])("rejects MAX_LIVE_ROOMS=%j", (value) => {
    expect(configErrorMessage({ ...validEnv, MAX_LIVE_ROOMS: value })).toContain("MAX_LIVE_ROOMS");
  });
});
