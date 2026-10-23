import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testConfig } from "../../test/helpers/config.js";
import { createAppPool, resetDatabase } from "../../test/helpers/db.js";
import { createFakeLogger } from "../../test/helpers/fake-logger.js";
import { createApp } from "../app.js";
import { createRoomService } from "../rooms/service.js";
import { createRoomsRouter } from "./rooms.js";

const pool = createAppPool();

function buildApp(configOverrides = {}) {
  const config = testConfig(configOverrides);
  const roomService = createRoomService({ pool, handoffMs: config.handoffMs });
  const router = createRoomsRouter({ pool, roomService, config });
  return createApp({ config, logger: createFakeLogger(), apiRouters: [router] });
}

const fromIp = (test, ip) => test.set("X-Forwarded-For", ip);
const createRoom = (app, ip = "203.0.113.1", name = "Room") =>
  fromIp(request(app).post("/api/rooms"), ip).send({ roomName: name, displayName: "Dana" });
const join = (app, code, name, ip = "203.0.113.1") =>
  fromIp(request(app).post(`/api/rooms/${code}/participants`), ip).send({
    displayName: name,
    role: "voter",
  });

describe("rate limits", () => {
  beforeEach(resetDatabase);
  afterAll(() => pool.end());

  it("allows 5 room creations per IP per 10 minutes, then answers 429", async () => {
    const app = buildApp();
    for (let index = 0; index < 5; index += 1) {
      expect((await createRoom(app, "203.0.113.1", `Room ${index}`)).status).toBe(201);
    }

    const response = await createRoom(app);

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      code: "RATE_LIMITED",
      error: "Too many requests. Please slow down.",
    });
  });

  it("counts each client IP separately", async () => {
    const app = buildApp();
    for (let index = 0; index < 5; index += 1) {
      await createRoom(app, "203.0.113.1", `Room ${index}`);
    }
    expect((await createRoom(app, "198.51.100.7")).status).toBe(201);
  });

  it("lets a whole class join from one shared IP: 60 joins a minute, then 429", async () => {
    const app = buildApp();
    const roomA = (await createRoom(app, "198.51.100.1")).body.code;
    const roomB = (await createRoom(app, "198.51.100.1")).body.code;

    for (let index = 1; index <= 49; index += 1) {
      expect((await join(app, roomA, `A ${index}`)).status).toBe(201);
    }
    for (let index = 1; index <= 11; index += 1) {
      expect((await join(app, roomB, `B ${index}`)).status).toBe(201);
    }

    const response = await join(app, roomB, "One too many");
    expect(response.status).toBe(429);
    expect(response.body.code).toBe("RATE_LIMITED");
  });
});

describe("live room cap", () => {
  beforeEach(resetDatabase);

  it("refuses new rooms with 503 once the cap is reached", async () => {
    const app = buildApp({ MAX_LIVE_ROOMS: "2" });
    await createRoom(app, "203.0.113.1", "One");
    await createRoom(app, "203.0.113.2", "Two");

    const response = await createRoom(app, "203.0.113.3", "Three");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      code: "CAPACITY",
      error: "The server is busy. Please try again later.",
    });
  });

  it("does not count ended rooms", async () => {
    const app = buildApp({ MAX_LIVE_ROOMS: "1" });
    await createRoom(app, "203.0.113.1", "One");
    await pool.query("UPDATE rooms SET status = 'ended'");

    expect((await createRoom(app, "203.0.113.2", "Two")).status).toBe(201);
  });
});
