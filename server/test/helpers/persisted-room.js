import { randomBytes, randomUUID } from "node:crypto";
import { expect } from "vitest";
import { insertRoomWithFacilitator } from "../../src/db/rooms.js";
import { persist } from "../../src/db/persist.js";
import { withTransaction } from "../../src/db/transaction.js";
import { reduce } from "../../src/rooms/reduce.js";
import { createRoomState } from "../../src/rooms/state.js";

export const START = Date.UTC(2026, 9, 23, 12, 0, 0);

// Creates a room both in memory and in the database, then lets tests apply actions the way
// RoomService will: reduce in memory, then persist the change in one transaction.
export async function createPersistedRoom(pool, { code = "ABCDEFGH" } = {}) {
  const facilitator = { id: randomUUID(), displayName: "Dana", tokenHash: randomBytes(32) };
  const roomId = randomUUID();
  await insertRoomWithFacilitator(pool, {
    roomId,
    code,
    name: "Sprint 12",
    facilitator,
    now: START,
  });
  let state = createRoomState({ id: roomId, code, name: "Sprint 12", facilitator, now: START });

  async function apply(action, now = START) {
    const result = reduce(state, action, now);
    expect(result.ok, `rejected with ${result.code}`).toBe(true);
    await withTransaction(pool, (client) =>
      persist(client, { previous: state, next: result.state, action, now }),
    );
    state = result.state;
    return state;
  }

  async function join(displayName, role = "voter", now = START) {
    const participant = { id: randomUUID(), displayName, role, tokenHash: randomBytes(32) };
    await apply({ type: "participantJoined", participant }, now);
    return participant.id;
  }

  return { roomId, facilitatorId: facilitator.id, apply, join, getState: () => state };
}
