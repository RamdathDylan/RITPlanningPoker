import { describe, expect, it } from "vitest";
import { NOW, buildRoom, buildVotingRoom } from "../../test/builders.js";
import { assertInvariants } from "../../test/invariants.js";
import { reduce } from "./reduce.js";

const revote = (actorId, roundId = "r1") => ({
  type: "roundRevoted",
  actorId,
  roundId,
  newRoundId: "r2",
});
const acceptEstimate = (actorId, value, storyId = "s1") => ({
  type: "estimateAccepted",
  actorId,
  storyId,
  value,
});
const rejected = (code) => ({ ok: false, code });

function revealedRoom(options = {}) {
  const room = buildVotingRoom({ votes: { "voter-1": "5", "voter-2": "8" }, ...options });
  return buildRoom({ ...room, status: "revealed", round: { ...room.round, revealedAt: NOW } });
}

function accepted(result) {
  expect(result.ok, `rejected with ${result.code}`).toBe(true);
  assertInvariants(result.state);
  return result.state;
}

describe("roundRevoted", () => {
  it("starts the next round on the same story with no votes", () => {
    const state = accepted(reduce(revealedRoom(), revote("facilitator"), NOW));

    expect(state.status).toBe("voting");
    expect(state.round).toEqual({
      id: "r2",
      storyId: "s1",
      number: 2,
      votes: {},
      revealedAt: null,
    });
    expect(state.stories[0].roundCount).toBe(2);
  });

  it("rejects a revote before the reveal", () => {
    const room = buildVotingRoom({ votes: { "voter-1": "5" } });
    expect(reduce(room, revote("facilitator"), NOW)).toEqual(rejected("INVALID_STATE"));
  });

  it("rejects a revote for an old round", () => {
    expect(reduce(revealedRoom(), revote("facilitator", "old"), NOW)).toEqual(
      rejected("STALE_ROUND"),
    );
  });

  it.each(["voter-1", "stranger"])("rejects a revote by %s", (actorId) => {
    expect(reduce(revealedRoom(), revote(actorId), NOW)).toEqual(rejected("FORBIDDEN"));
  });
});

describe("estimateAccepted", () => {
  it("records the estimate on the story and returns the room to idle", () => {
    const state = accepted(reduce(revealedRoom(), acceptEstimate("facilitator", "5"), NOW));

    expect(state.status).toBe("idle");
    expect(state.currentStoryId).toBeNull();
    expect(state.round).toBeNull();
    expect(state.stories[0]).toMatchObject({ status: "estimated", finalEstimate: "5" });
  });

  it.each(["?", "☕", "4"])("rejects %j as a final estimate", (value) => {
    expect(reduce(revealedRoom(), acceptEstimate("facilitator", value), NOW)).toEqual(
      rejected("INVALID_PAYLOAD"),
    );
  });

  it("rejects accepting before the reveal", () => {
    const room = buildVotingRoom({ votes: { "voter-1": "5" } });
    expect(reduce(room, acceptEstimate("facilitator", "5"), NOW)).toEqual(
      rejected("INVALID_STATE"),
    );
  });

  it("rejects accepting for a story that isn't the current one", () => {
    expect(reduce(revealedRoom(), acceptEstimate("facilitator", "5", "s9"), NOW)).toEqual(
      rejected("INVALID_STATE"),
    );
  });

  it.each(["voter-1", "stranger"])("rejects accepting by %s", (actorId) => {
    expect(reduce(revealedRoom(), acceptEstimate(actorId, "5"), NOW)).toEqual(
      rejected("FORBIDDEN"),
    );
  });
});
