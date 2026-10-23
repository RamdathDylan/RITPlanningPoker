import express from "express";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testConfig } from "../../test/helpers/config.js";
import { createAppPool, resetDatabase } from "../../test/helpers/db.js";
import { createFakeLogger } from "../../test/helpers/fake-logger.js";
import { createApp } from "../app.js";
import { hashToken } from "../auth/tokens.js";
import { createRoomsRouter } from "./rooms.js";

const pool = createAppPool();
const NOW = Date.UTC(2026, 9, 23, 12, 0, 0);

function buildApp(routerOptions = {}) {
  const router = createRoomsRouter({ pool, now: () => NOW, ...routerOptions });
  return createApp({ config: testConfig(), logger: createFakeLogger(), apiRouters: [router] });
}

const createRoom = (app, body) => request(app).post("/api/rooms").send(body);

describe("POST /api/rooms", () => {
  beforeEach(resetDatabase);
  afterAll(() => pool.end());

  it("creates a room and returns its code, the facilitator's id, and a rejoin token", async () => {
    const response = await createRoom(buildApp(), { roomName: "Sprint 12", displayName: "Dana" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      code: expect.stringMatching(/^[2-9A-HJKMNP-Z]{8}$/),
      participantId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      rejoinToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
  });

  it("stores normalized names and only the token's hash", async () => {
    const response = await createRoom(buildApp(), {
      roomName: "  Sprint   12 ",
      displayName: " Dana ",
    });
    const { code, participantId, rejoinToken } = response.body;

    const { rows } = await pool.query(
      `SELECT r.name, r.facilitator_id, p.display_name, p.rejoin_token_hash
       FROM rooms r JOIN participants p ON p.room_id = r.id WHERE r.join_code = $1`,
      [code],
    );
    expect(rows).toEqual([
      {
        name: "Sprint 12",
        facilitator_id: participantId,
        display_name: "Dana",
        rejoin_token_hash: hashToken(rejoinToken),
      },
    ]);
  });

  it.each([
    ["a 61-character room name", { roomName: "x".repeat(61), displayName: "Dana" }],
    ["a 41-character display name", { roomName: "Sprint", displayName: "x".repeat(41) }],
    ["an extra key", { roomName: "Sprint", displayName: "Dana", facilitator: true }],
    ["a missing key", { roomName: "Sprint" }],
    ["hidden characters", { roomName: "Sprint", displayName: "Da‮na" }],
  ])("rejects %s with a generic 400", async (_label, body) => {
    const response = await createRoom(buildApp(), body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ code: "INVALID_PAYLOAD", error: "That request wasn't valid." });
  });

  it("rejects a request with no JSON body", async () => {
    const response = await request(buildApp())
      .post("/api/rooms")
      .set("Content-Type", "text/plain")
      .send("hi");
    expect(response.status).toBe(400);
  });

  it("retries with a new code when the first one is already taken", async () => {
    const taken = (await createRoom(buildApp(), { roomName: "First", displayName: "Dana" })).body
      .code;
    const codes = [taken, "Z2345678"];

    const response = await createRoom(buildApp({ generateCode: () => codes.shift() }), {
      roomName: "Second",
      displayName: "Riley",
    });

    expect(response.status).toBe(201);
    expect(response.body.code).toBe("Z2345678");
  });

  it("gives up with a generic 500 if every code it tries is taken", async () => {
    const taken = (await createRoom(buildApp(), { roomName: "First", displayName: "Dana" })).body
      .code;

    const response = await createRoom(buildApp({ generateCode: () => taken }), {
      roomName: "Second",
      displayName: "Riley",
    });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "Something went wrong" });
  });
});
