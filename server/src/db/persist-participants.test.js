import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAppPool, resetDatabase } from "../../test/helpers/db.js";
import { START, createPersistedRoom } from "../../test/helpers/persisted-room.js";

const pool = createAppPool();
const LATER = START + 60_000;

async function participantRows(roomId) {
  const { rows } = await pool.query(
    `SELECT id, display_name AS "displayName", role, last_seen AS "lastSeen"
     FROM participants WHERE room_id = $1 ORDER BY joined_at, id`,
    [roomId],
  );
  return rows;
}

async function roomRow(roomId) {
  const { rows } = await pool.query(
    `SELECT facilitator_id AS "facilitatorId", last_activity_at AS "lastActivityAt"
     FROM rooms WHERE id = $1`,
    [roomId],
  );
  return rows[0];
}

describe("persisting participant actions", () => {
  beforeEach(resetDatabase);
  afterAll(() => pool.end());

  it("inserts a joining participant with their role and token hash, and records activity", async () => {
    const room = await createPersistedRoom(pool);
    const id = await room.join("Riley", "observer", LATER);

    const rows = await participantRows(room.roomId);
    expect(rows.find((row) => row.id === id)).toMatchObject({
      displayName: "Riley",
      role: "observer",
    });
    const { rows: hashes } = await pool.query(
      "SELECT octet_length(rejoin_token_hash) AS bytes FROM participants WHERE id = $1",
      [id],
    );
    expect(hashes[0].bytes).toBe(32);
    expect((await roomRow(room.roomId)).lastActivityAt).toEqual(new Date(LATER));
  });

  it("records last_seen when a participant connects and disconnects", async () => {
    const room = await createPersistedRoom(pool);
    await room.apply({ type: "participantConnected", participantId: room.facilitatorId }, LATER);
    expect((await participantRows(room.roomId))[0].lastSeen).toEqual(new Date(LATER));

    await room.apply(
      { type: "participantDisconnected", participantId: room.facilitatorId },
      LATER + 5,
    );
    expect((await participantRows(room.roomId))[0].lastSeen).toEqual(new Date(LATER + 5));
  });

  it("updates a participant's role", async () => {
    const room = await createPersistedRoom(pool);
    const id = await room.join("Riley");
    await room.apply({ type: "roleChanged", actorId: id, role: "observer" });

    expect((await participantRows(room.roomId)).find((row) => row.id === id).role).toBe("observer");
  });

  it("deletes a participant who leaves", async () => {
    const room = await createPersistedRoom(pool);
    const id = await room.join("Riley");
    await room.apply({ type: "participantLeft", actorId: id });

    expect((await participantRows(room.roomId)).map((row) => row.id)).toEqual([room.facilitatorId]);
  });

  it("moves the facilitator in the database when the facilitator leaves", async () => {
    const room = await createPersistedRoom(pool);
    const id = await room.join("Riley", "voter", START + 1);
    await room.apply({ type: "participantLeft", actorId: room.facilitatorId });

    expect((await roomRow(room.roomId)).facilitatorId).toBe(id);
  });

  it("deletes a removed participant", async () => {
    const room = await createPersistedRoom(pool);
    const id = await room.join("Riley");
    await room.apply({
      type: "participantRemoved",
      actorId: room.facilitatorId,
      participantId: id,
    });

    expect((await participantRows(room.roomId)).map((row) => row.id)).not.toContain(id);
  });

  it("records a facilitator transfer", async () => {
    const room = await createPersistedRoom(pool);
    const id = await room.join("Riley");
    await room.apply({
      type: "facilitatorTransferred",
      actorId: room.facilitatorId,
      participantId: id,
    });

    expect((await roomRow(room.roomId)).facilitatorId).toBe(id);
  });

  it("records an automatic handoff", async () => {
    const room = await createPersistedRoom(pool);
    const id = await room.join("Riley");
    await room.apply({ type: "participantConnected", participantId: id });
    await room.apply({ type: "participantDisconnected", participantId: room.facilitatorId }, START);
    await room.apply({ type: "facilitatorHandoff", delayMs: 60_000 }, START + 60_000);

    expect((await roomRow(room.roomId)).facilitatorId).toBe(id);
  });
});
