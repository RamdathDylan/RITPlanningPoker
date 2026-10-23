import { describe, expect, it } from "vitest";
import { NOW, buildRoom, buildVotingRoom } from "../../test/builders.js";
import { assertInvariants } from "../../test/invariants.js";
import { reduce } from "./reduce.js";

const cast = (actorId, value, roundId = "r1") => ({ type: "voteCast", actorId, roundId, value });
const clear = (actorId, roundId = "r1") => ({ type: "voteCleared", actorId, roundId });

function accepted(result) {
  expect(result.ok, `rejected with ${result.code}`).toBe(true);
  assertInvariants(result.state);
  return result.state;
}

const rejected = (code) => ({ ok: false, code });

describe("voteCast", () => {
  it("records a voter's card", () => {
    const state = accepted(reduce(buildVotingRoom(), cast("voter-1", "5"), NOW));
    expect(state.round.votes).toEqual({ "voter-1": "5" });
  });

  it("replaces the voter's previous card", () => {
    const room = buildVotingRoom({ votes: { "voter-1": "5", "voter-2": "3" } });
    const state = accepted(reduce(room, cast("voter-1", "8"), NOW));
    expect(state.round.votes).toEqual({ "voter-1": "8", "voter-2": "3" });
  });

  it("lets the facilitator vote while they are a voter", () => {
    accepted(reduce(buildVotingRoom(), cast("facilitator", "?"), NOW));
  });

  it.each(["?", "☕", "0", "21"])("accepts the card %j", (value) => {
    accepted(reduce(buildVotingRoom(), cast("voter-1", value), NOW));
  });

  it("rejects a card that isn't in the deck", () => {
    expect(reduce(buildVotingRoom(), cast("voter-1", "4"), NOW)).toEqual(
      rejected("INVALID_PAYLOAD"),
    );
  });

  it.each([
    ["an observer", "observer-1"],
    ["someone not in the room", "stranger"],
  ])("rejects a vote from %s", (_label, actorId) => {
    expect(reduce(buildVotingRoom({ observers: 1 }), cast(actorId, "5"), NOW)).toEqual(
      rejected("FORBIDDEN"),
    );
  });

  it("rejects voting when no round is open", () => {
    expect(reduce(buildRoom(), cast("voter-1", "5"), NOW)).toEqual(rejected("INVALID_STATE"));
  });

  it("rejects voting after the reveal", () => {
    const voting = buildVotingRoom({ votes: { "voter-2": "3" } });
    const revealed = buildRoom({
      ...voting,
      status: "revealed",
      round: { ...voting.round, revealedAt: NOW },
    });
    expect(reduce(revealed, cast("voter-1", "5"), NOW)).toEqual(rejected("INVALID_STATE"));
  });

  it("rejects a vote for an old round", () => {
    expect(reduce(buildVotingRoom(), cast("voter-1", "5", "old-round"), NOW)).toEqual(
      rejected("STALE_ROUND"),
    );
  });
});

describe("voteCleared", () => {
  it("removes the voter's card", () => {
    const room = buildVotingRoom({ votes: { "voter-1": "5", "voter-2": "3" } });
    const state = accepted(reduce(room, clear("voter-1"), NOW));
    expect(state.round.votes).toEqual({ "voter-2": "3" });
  });

  it("rejects clearing when the voter hasn't voted", () => {
    expect(reduce(buildVotingRoom(), clear("voter-1"), NOW)).toEqual(rejected("NO_VOTE"));
  });

  it("rejects clearing for an old round", () => {
    const room = buildVotingRoom({ votes: { "voter-1": "5" } });
    expect(reduce(room, clear("voter-1", "old-round"), NOW)).toEqual(rejected("STALE_ROUND"));
  });

  it("rejects clearing when no round is open", () => {
    expect(reduce(buildRoom(), clear("voter-1"), NOW)).toEqual(rejected("INVALID_STATE"));
  });

  it("rejects clearing by an observer", () => {
    expect(reduce(buildVotingRoom({ observers: 1 }), clear("observer-1"), NOW)).toEqual(
      rejected("FORBIDDEN"),
    );
  });
});
