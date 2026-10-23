import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAppPool, resetDatabase } from "../../test/helpers/db.js";
import { findParticipantByTokenHash } from "./participants.js";
import { findRoomByCode, insertRoomWithFacilitator } from "./rooms.js";

const pool = createAppPool();

function newRoom(overrides = {}) {
  return {
    roomId: randomUUID(),
    code: "ABCDEFGH",
    name: "Sprint 12",
    facilitator: { id: randomUUID(), displayName: "Dana", tokenHash: randomBytes(32) },
    ...overrides,
  };
}

describe("room and participant queries", () => {
  beforeEach(resetDatabase);
  afterAll(() => pool.end());

  it("creates a room and its facilitator together with the given ids", async () => {
    const room = newRoom();
    await insertRoomWithFacilitator(pool, room);

    expect(await findRoomByCode(pool, "ABCDEFGH")).toEqual({
      id: room.roomId,
      code: "ABCDEFGH",
      name: "Sprint 12",
      status: "idle",
      facilitatorId: room.facilitator.id,
    });
  });

  it("returns null for an unknown room code", async () => {
    expect(await findRoomByCode(pool, "ZZZZZZZZ")).toBeNull();
  });

  it("finds a participant by the hash of their rejoin token", async () => {
    const room = newRoom();
    await insertRoomWithFacilitator(pool, room);

    expect(await findParticipantByTokenHash(pool, room.facilitator.tokenHash)).toEqual({
      id: room.facilitator.id,
      roomId: room.roomId,
      displayName: "Dana",
      role: "voter",
    });
  });

  it("returns null for a token hash nobody has", async () => {
    expect(await findParticipantByTokenHash(pool, randomBytes(32))).toBeNull();
  });

  it("stores text containing SQL syntax literally", async () => {
    const sneaky = "Robert'); DROP TABLE rooms;--";
    const room = newRoom({
      name: sneaky,
      facilitator: { ...newRoom().facilitator, displayName: sneaky },
    });
    await insertRoomWithFacilitator(pool, room);

    expect((await findRoomByCode(pool, "ABCDEFGH")).name).toBe(sneaky);
    expect((await findParticipantByTokenHash(pool, room.facilitator.tokenHash)).displayName).toBe(
      sneaky,
    );
  });

  it("rejects a duplicate join code with a unique violation and leaves nothing behind", async () => {
    await insertRoomWithFacilitator(pool, newRoom());
    const duplicate = newRoom();

    await expect(insertRoomWithFacilitator(pool, duplicate)).rejects.toMatchObject({
      code: "23505",
    });
    expect(await findParticipantByTokenHash(pool, duplicate.facilitator.tokenHash)).toBeNull();
  });
});
