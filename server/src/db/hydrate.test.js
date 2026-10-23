import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAppPool, resetDatabase } from "../../test/helpers/db.js";
import { START, createPersistedRoom } from "../../test/helpers/persisted-room.js";
import { loadRoomState } from "./hydrate.js";

const pool = createAppPool();

// After a restart nobody is connected yet; everything else must match memory exactly.
function asAfterRestart(state) {
  return {
    ...state,
    participants: state.participants.map((participant) => ({
      ...participant,
      connected: false,
      connectedAt: null,
      disconnectedAt: null,
    })),
  };
}

async function expectRoundTrip(room) {
  expect(await loadRoomState(pool, room.roomId)).toEqual(asAfterRestart(room.getState()));
}

async function roomWithStories() {
  const room = await createPersistedRoom(pool);
  const voterId = await room.join("Riley", "voter", START + 1);
  await room.join("Sam", "observer", START + 2);
  await room.apply({ type: "participantConnected", participantId: voterId }, START + 3);
  const storyIds = [randomUUID(), randomUUID()];
  await room.apply({
    type: "storiesAdded",
    actorId: room.facilitatorId,
    stories: [
      { id: storyIds[0], title: "Login" },
      { id: storyIds[1], title: "Signup" },
    ],
  });
  return { ...room, voterId, storyIds };
}

async function voting(room, storyId = room.storyIds[0]) {
  const roundId = randomUUID();
  await room.apply({ type: "storySelected", actorId: room.facilitatorId, storyId, roundId });
  return roundId;
}

describe("loadRoomState", () => {
  beforeEach(resetDatabase);
  afterAll(() => pool.end());

  it("returns null for a room that doesn't exist", async () => {
    expect(await loadRoomState(pool, randomUUID())).toBeNull();
  });

  it("restores an idle room with participants and stories", async () => {
    await expectRoundTrip(await roomWithStories());
  });

  it("restores a room mid-vote, including hidden votes", async () => {
    const room = await roomWithStories();
    const roundId = await voting(room);
    await room.apply({ type: "voteCast", actorId: room.voterId, roundId, value: "8" });
    await room.apply({ type: "voteCast", actorId: room.facilitatorId, roundId, value: "?" });
    await expectRoundTrip(room);
  });

  it("restores a revealed round", async () => {
    const room = await roomWithStories();
    const roundId = await voting(room);
    await room.apply({ type: "voteCast", actorId: room.voterId, roundId, value: "5" });
    await room.apply({ type: "roundRevealed", actorId: room.facilitatorId, roundId }, START + 50);
    await expectRoundTrip(room);
  });

  it("restores only the current round after a revote", async () => {
    const room = await roomWithStories();
    const roundId = await voting(room);
    await room.apply({ type: "voteCast", actorId: room.voterId, roundId, value: "5" });
    await room.apply({ type: "roundRevealed", actorId: room.facilitatorId, roundId });
    await room.apply({
      type: "roundRevoted",
      actorId: room.facilitatorId,
      roundId,
      newRoundId: randomUUID(),
    });
    await expectRoundTrip(room);
  });

  it("ignores an abandoned round when another story was selected mid-vote", async () => {
    const room = await roomWithStories();
    const firstRound = await voting(room, room.storyIds[0]);
    await room.apply({ type: "voteCast", actorId: room.voterId, roundId: firstRound, value: "3" });
    await voting(room, room.storyIds[1]);
    await expectRoundTrip(room);
  });

  it("restores estimated stories and round counts after an accept", async () => {
    const room = await roomWithStories();
    const roundId = await voting(room);
    await room.apply({ type: "voteCast", actorId: room.voterId, roundId, value: "5" });
    await room.apply({ type: "roundRevealed", actorId: room.facilitatorId, roundId });
    await room.apply({
      type: "estimateAccepted",
      actorId: room.facilitatorId,
      storyId: room.storyIds[0],
      value: "5",
    });
    await expectRoundTrip(room);
  });

  it("restores an ended room", async () => {
    const room = await roomWithStories();
    await room.apply({ type: "roomEnded", actorId: room.facilitatorId });
    await expectRoundTrip(room);
  });
});
