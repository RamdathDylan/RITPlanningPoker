import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAppPool, resetDatabase } from "../../test/helpers/db.js";
import { START, createPersistedRoom } from "../../test/helpers/persisted-room.js";

const pool = createAppPool();
const LATER = START + 30_000;

async function rows(sql, params) {
  return (await pool.query(sql, params)).rows;
}

// A room with two stories, voting on the first, and one extra voter ("Riley").
async function votingRoom() {
  const room = await createPersistedRoom(pool);
  const voterId = await room.join("Riley");
  const storyIds = [randomUUID(), randomUUID()];
  await room.apply({
    type: "storiesAdded",
    actorId: room.facilitatorId,
    stories: [
      { id: storyIds[0], title: "Login" },
      { id: storyIds[1], title: "Signup" },
    ],
  });
  const roundId = randomUUID();
  await room.apply(
    { type: "storySelected", actorId: room.facilitatorId, storyId: storyIds[0], roundId },
    LATER,
  );
  return { ...room, voterId, storyIds, roundId };
}

const votesIn = (roundId) =>
  rows(
    `SELECT participant_id AS "participantId", value FROM votes WHERE round_id = $1
     ORDER BY value`,
    [roundId],
  );

describe("persisting stories, rounds, and votes", () => {
  beforeEach(resetDatabase);
  afterAll(() => pool.end());

  it("inserts added stories with positions", async () => {
    const room = await votingRoom();
    expect(
      await rows(
        "SELECT id, title, position, status FROM stories WHERE room_id = $1 ORDER BY position",
        [room.roomId],
      ),
    ).toEqual([
      { id: room.storyIds[0], title: "Login", position: 0, status: "pending" },
      { id: room.storyIds[1], title: "Signup", position: 1, status: "pending" },
    ]);
  });

  it("starts a round and records the room's current story and status", async () => {
    const room = await votingRoom();
    expect(
      await rows(
        `SELECT id, story_id AS "storyId", round_number AS number, started_at AS "startedAt",
                revealed_at AS "revealedAt" FROM rounds`,
      ),
    ).toEqual([
      {
        id: room.roundId,
        storyId: room.storyIds[0],
        number: 1,
        startedAt: new Date(LATER),
        revealedAt: null,
      },
    ]);
    expect(
      await rows(`SELECT status, current_story_id AS "currentStoryId" FROM rooms WHERE id = $1`, [
        room.roomId,
      ]),
    ).toEqual([{ status: "voting", currentStoryId: room.storyIds[0] }]);
  });

  it("stores a vote and replaces it when the voter changes their mind", async () => {
    const room = await votingRoom();
    await room.apply({
      type: "voteCast",
      actorId: room.voterId,
      roundId: room.roundId,
      value: "5",
    });
    await room.apply({
      type: "voteCast",
      actorId: room.voterId,
      roundId: room.roundId,
      value: "8",
    });

    expect(await votesIn(room.roundId)).toEqual([{ participantId: room.voterId, value: "8" }]);
  });

  it("deletes a cleared vote", async () => {
    const room = await votingRoom();
    await room.apply({
      type: "voteCast",
      actorId: room.voterId,
      roundId: room.roundId,
      value: "5",
    });
    await room.apply({ type: "voteCleared", actorId: room.voterId, roundId: room.roundId });

    expect(await votesIn(room.roundId)).toEqual([]);
  });

  it("deletes the open-round vote of someone who switches to observer", async () => {
    const room = await votingRoom();
    await room.apply({
      type: "voteCast",
      actorId: room.voterId,
      roundId: room.roundId,
      value: "5",
    });
    await room.apply({ type: "roleChanged", actorId: room.voterId, role: "observer" });

    expect(await votesIn(room.roundId)).toEqual([]);
  });

  it("records the reveal time", async () => {
    const room = await votingRoom();
    await room.apply({
      type: "voteCast",
      actorId: room.voterId,
      roundId: room.roundId,
      value: "5",
    });
    await room.apply(
      { type: "roundRevealed", actorId: room.facilitatorId, roundId: room.roundId },
      LATER + 1,
    );

    expect(
      await rows(`SELECT revealed_at AS "revealedAt" FROM rounds WHERE id = $1`, [room.roundId]),
    ).toEqual([{ revealedAt: new Date(LATER + 1) }]);
  });

  it("starts round 2 on a revote", async () => {
    const room = await votingRoom();
    await room.apply({
      type: "voteCast",
      actorId: room.voterId,
      roundId: room.roundId,
      value: "5",
    });
    await room.apply({ type: "roundRevealed", actorId: room.facilitatorId, roundId: room.roundId });
    const newRoundId = randomUUID();
    await room.apply({
      type: "roundRevoted",
      actorId: room.facilitatorId,
      roundId: room.roundId,
      newRoundId,
    });

    expect(
      await rows("SELECT round_number AS number FROM rounds WHERE id = $1", [newRoundId]),
    ).toEqual([{ number: 2 }]);
  });

  it("records an accepted estimate and returns the room to idle", async () => {
    const room = await votingRoom();
    await room.apply({
      type: "voteCast",
      actorId: room.voterId,
      roundId: room.roundId,
      value: "5",
    });
    await room.apply({ type: "roundRevealed", actorId: room.facilitatorId, roundId: room.roundId });
    await room.apply({
      type: "estimateAccepted",
      actorId: room.facilitatorId,
      storyId: room.storyIds[0],
      value: "5",
    });

    expect(
      await rows(`SELECT status, final_estimate AS "finalEstimate" FROM stories WHERE id = $1`, [
        room.storyIds[0],
      ]),
    ).toEqual([{ status: "estimated", finalEstimate: "5" }]);
    expect(
      await rows(`SELECT status, current_story_id AS "currentStoryId" FROM rooms WHERE id = $1`, [
        room.roomId,
      ]),
    ).toEqual([{ status: "idle", currentStoryId: null }]);
  });

  it("records the end of the room", async () => {
    const room = await votingRoom();
    await room.apply({ type: "roomEnded", actorId: room.facilitatorId });

    expect(await rows("SELECT status FROM rooms WHERE id = $1", [room.roomId])).toEqual([
      { status: "ended" },
    ]);
  });
});
