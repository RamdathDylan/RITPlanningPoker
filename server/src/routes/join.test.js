import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testConfig } from "../../test/helpers/config.js";
import { createAppPool, resetDatabase } from "../../test/helpers/db.js";
import { createFakeLogger } from "../../test/helpers/fake-logger.js";
import { createApp } from "../app.js";
import { hashToken } from "../auth/tokens.js";
import { createRoomService } from "../rooms/service.js";
import { createRoomsRouter } from "./rooms.js";

const pool = createAppPool();

function buildApp() {
  const roomService = createRoomService({ pool, handoffMs: 60_000 });
  const router = createRoomsRouter({ pool, roomService });
  return {
    app: createApp({ config: testConfig(), logger: createFakeLogger(), apiRouters: [router] }),
    roomService,
  };
}

async function createRoom(app) {
  const response = await request(app)
    .post("/api/rooms")
    .send({ roomName: "Sprint 12", displayName: "Dana" });
  return response.body;
}

const join = (app, code, body) => request(app).post(`/api/rooms/${code}/participants`).send(body);

describe("POST /api/rooms/:code/participants", () => {
  beforeEach(resetDatabase);
  afterAll(() => pool.end());

  it("seats a new participant and returns their id and rejoin token", async () => {
    const { app } = buildApp();
    const { code } = await createRoom(app);

    const response = await join(app, code, { displayName: "Riley", role: "voter" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      participantId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      rejoinToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
    const { rows } = await pool.query(
      "SELECT display_name, role, rejoin_token_hash FROM participants WHERE id = $1",
      [response.body.participantId],
    );
    expect(rows).toEqual([
      {
        display_name: "Riley",
        role: "voter",
        rejoin_token_hash: hashToken(response.body.rejoinToken),
      },
    ]);
  });

  it("accepts the code in any case and with a dash", async () => {
    const { app } = buildApp();
    const { code } = await createRoom(app);
    const typed = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();

    expect((await join(app, typed, { displayName: "Riley", role: "voter" })).status).toBe(201);
  });

  it("seats an observer when asked", async () => {
    const { app, roomService } = buildApp();
    const { code } = await createRoom(app);
    const { body } = await join(app, code, { displayName: "Instructor", role: "observer" });

    const { rows } = await pool.query("SELECT room_id FROM participants WHERE id = $1", [
      body.participantId,
    ]);
    const state = await roomService.getRoom(rows[0].room_id);
    expect(
      state.participants.find((participant) => participant.id === body.participantId).role,
    ).toBe("observer");
  });

  it("gives identical 404s for unknown, malformed, and ended rooms", async () => {
    const { app, roomService } = buildApp();
    const created = await createRoom(app);
    const { rows } = await pool.query("SELECT id FROM rooms WHERE join_code = $1", [created.code]);
    await roomService.dispatch(rows[0].id, { type: "roomEnded", actorId: created.participantId });

    const responses = await Promise.all(
      ["ZZZZZZZZ", "not-a-code", created.code].map((code) =>
        join(app, code, { displayName: "Riley", role: "voter" }),
      ),
    );

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ code: "NOT_FOUND", error: "Room not found." });
    }
  });

  it("rejects a name already used in the room, ignoring case", async () => {
    const { app } = buildApp();
    const { code } = await createRoom(app);

    const response = await join(app, code, { displayName: "DANA", role: "voter" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      code: "NAME_TAKEN",
      error: "Someone in this room already uses that name.",
    });
  });

  it("rejects the 51st participant", async () => {
    const { app } = buildApp();
    const { code } = await createRoom(app);
    for (let index = 1; index < 50; index += 1) {
      expect((await join(app, code, { displayName: `Voter ${index}`, role: "voter" })).status).toBe(
        201,
      );
    }

    const response = await join(app, code, { displayName: "One too many", role: "voter" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ code: "ROOM_FULL", error: "This room is full." });
  });

  it("rejects an invalid body with a generic 400", async () => {
    const { app } = buildApp();
    const { code } = await createRoom(app);

    const response = await join(app, code, { displayName: "Riley", role: "facilitator" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_PAYLOAD");
  });
});
