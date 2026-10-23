import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../test/helpers/db.js";
import {
  connectAndJoin,
  connectionOutcome,
  nothingReceived,
  startTestServer,
  waitFor,
} from "../../test/helpers/socket-harness.js";

describe("ending and deleting a room", () => {
  let server;
  let room;
  let rileySeat;
  let dana;
  let riley;

  beforeEach(async () => {
    await resetDatabase();
    server = await startTestServer();
    room = await server.seedRoom();
    rileySeat = await server.addParticipant(room.roomId, "Riley");
    dana = (await connectAndJoin(server, { token: room.facilitatorToken, code: room.code })).socket;
    riley = (await connectAndJoin(server, { token: rileySeat.token, code: room.code })).socket;
  });

  afterEach(async () => {
    await server.close();
  });

  it("ends the room for everyone and refuses changes afterwards", async () => {
    const rileySees = waitFor(riley, "room:ended");

    expect(await dana.emitWithAck("room:end", {})).toEqual({ ok: true });

    expect(await rileySees).toEqual({});
    expect((await dana.emitWithAck("story:add", { titles: ["Too late"] })).error.code).toBe(
      "INVALID_STATE",
    );
  });

  it("refuses to end the room for a non-facilitator", async () => {
    expect((await riley.emitWithAck("room:end", {})).error.code).toBe("FORBIDDEN");
  });

  it("refuses deletion when the typed code doesn't match", async () => {
    const quiet = nothingReceived(riley, "room:removed");

    const ack = await dana.emitWithAck("room:delete", { code: "Z2345678" });

    expect(ack.error.code).toBe("INVALID_PAYLOAD");
    await quiet;
    expect(await server.roomService.getRoom(room.roomId)).not.toBeNull();
  });

  it("refuses deletion by a non-facilitator", async () => {
    expect((await riley.emitWithAck("room:delete", { code: room.code })).error.code).toBe(
      "FORBIDDEN",
    );
  });

  it("deletes everything, tells everyone, disconnects them, and invalidates every token", async () => {
    const rileyTold = waitFor(riley, "room:removed");
    const rileyDropped = waitFor(riley, "disconnect");

    expect(await dana.emitWithAck("room:delete", { code: room.code })).toEqual({ ok: true });

    expect(await rileyTold).toEqual({ reason: "deleted" });
    expect((await rileyDropped)[0]).toBe("io server disconnect");
    const { rows } = await server.pool.query(
      `SELECT (SELECT count(*)::int FROM rooms WHERE id = $1) AS rooms,
              (SELECT count(*)::int FROM participants WHERE room_id = $1) AS participants`,
      [room.roomId],
    );
    expect(rows[0]).toEqual({ rooms: 0, participants: 0 });
    expect(await server.roomService.getRoom(room.roomId)).toBeNull();
    for (const token of [room.facilitatorToken, rileySeat.token]) {
      expect(await connectionOutcome(server.connectClient({ auth: { token } }))).toBe(
        "Unauthorized",
      );
    }
  });
});
