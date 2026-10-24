import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testConfig } from "../../test/helpers/config.js";
import { createAppPool, resetDatabase } from "../../test/helpers/db.js";
import { createFakeLogger } from "../../test/helpers/fake-logger.js";
import { createApp } from "../app.js";
import { createRoomService } from "../rooms/service.js";
import { createRoomsRouter } from "./rooms.js";

const pool = createAppPool();
afterAll(() => pool.end());

function buildApp() {
  const config = testConfig();
  const roomService = createRoomService({ pool, handoffMs: config.handoffMs });
  const app = createApp({
    config,
    logger: createFakeLogger(),
    apiRouters: [createRoomsRouter({ pool, roomService, config })],
  });
  return { app, roomService };
}

async function roomWithEstimates(app, roomService) {
  const host = (
    await request(app).post("/api/rooms").send({ roomName: "Sprint", displayName: "Dana" })
  ).body;
  const voter = (
    await request(app)
      .post(`/api/rooms/${host.code}/participants`)
      .send({ displayName: "Riley", role: "voter" })
  ).body;
  const { rows } = await pool.query("SELECT id FROM rooms WHERE join_code = $1", [host.code]);
  const roomId = rows[0].id;
  const [login, formula] = [randomUUID(), randomUUID()];
  const act = (action) => roomService.dispatch(roomId, { actorId: host.participantId, ...action });
  await act({
    type: "storiesAdded",
    stories: [
      { id: login, title: "Login" },
      { id: formula, title: '=HYPERLINK("x")' },
    ],
  });
  const roundId = randomUUID();
  await act({ type: "storySelected", storyId: login, roundId });
  await act({ type: "voteCast", roundId, value: "5" });
  await act({ type: "roundRevealed", roundId });
  await act({ type: "estimateAccepted", storyId: login, value: "5" });
  return { code: host.code, facilitatorToken: host.rejoinToken, voterToken: voter.rejoinToken };
}

const exportCsv = (app, code, token) => {
  const call = request(app).get(`/api/rooms/${code}/export.csv`);
  return token ? call.set("Authorization", `Bearer ${token}`) : call;
};

describe("GET /api/rooms/:code/export.csv", () => {
  beforeEach(resetDatabase);

  it("gives the facilitator a CSV download of the estimates", async () => {
    const { app, roomService } = buildApp();
    const room = await roomWithEstimates(app, roomService);

    const response = await exportCsv(app, room.code, room.facilitatorToken);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(response.headers["content-disposition"]).toBe(
      `attachment; filename="planning-poker-${room.code}.csv"`,
    );
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.text).toBe(
      '"Story","Final estimate"\r\n"Login","5"\r\n"\'=HYPERLINK(""x"")",""\r\n',
    );
  });

  it("lets every participant download it, voters and observers alike", async () => {
    const { app, roomService } = buildApp();
    const room = await roomWithEstimates(app, roomService);
    const observer = (
      await request(app)
        .post(`/api/rooms/${room.code}/participants`)
        .send({ displayName: "Olive", role: "observer" })
    ).body;

    for (const token of [room.voterToken, observer.rejoinToken]) {
      const response = await exportCsv(app, room.code, token);
      expect(response.status).toBe(200);
      expect(response.text).toContain('"Login","5"');
    }
  });

  it("requires the token in the Authorization header, never the URL", async () => {
    const { app, roomService } = buildApp();
    const room = await roomWithEstimates(app, roomService);

    expect((await exportCsv(app, room.code)).status).toBe(401);
    const viaQuery = await request(app).get(
      `/api/rooms/${room.code}/export.csv?token=${room.facilitatorToken}`,
    );
    expect(viaQuery.status).toBe(401);
  });

  it("refuses a malformed token", async () => {
    const { app, roomService } = buildApp();
    const room = await roomWithEstimates(app, roomService);
    expect((await exportCsv(app, room.code, "not-a-token")).status).toBe(401);
  });

  it("treats another room's facilitator like an unknown room", async () => {
    const { app, roomService } = buildApp();
    const room = await roomWithEstimates(app, roomService);
    const other = (
      await request(app).post("/api/rooms").send({ roomName: "Other", displayName: "Sam" })
    ).body;

    const response = await exportCsv(app, room.code, other.rejoinToken);

    expect(response.status).toBe(404);
    expect((await exportCsv(app, "ZZZZZZZZ", room.facilitatorToken)).status).toBe(404);
  });
});
