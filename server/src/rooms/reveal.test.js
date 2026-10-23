import { describe, expect, it } from "vitest";
import { NOW, buildRoom, buildVotingRoom } from "../../test/builders.js";
import { assertInvariants } from "../../test/invariants.js";
import { reduce } from "./reduce.js";

const reveal = (actorId, roundId = "r1") => ({ type: "roundRevealed", actorId, roundId });
const rejected = (code) => ({ ok: false, code });

describe("roundRevealed", () => {
  it("lets the facilitator reveal once someone has voted", () => {
    const room = buildVotingRoom({ votes: { "voter-1": "5" } });
    const result = reduce(room, reveal("facilitator"), NOW + 10);

    expect(result.ok).toBe(true);
    assertInvariants(result.state);
    expect(result.state.status).toBe("revealed");
    expect(result.state.round).toEqual({ ...room.round, revealedAt: NOW + 10 });
  });

  it("rejects revealing with no votes", () => {
    expect(reduce(buildVotingRoom(), reveal("facilitator"), NOW)).toEqual(rejected("NO_VOTES"));
  });

  it("rejects a second reveal of the same round (double click)", () => {
    const first = reduce(
      buildVotingRoom({ votes: { "voter-1": "5" } }),
      reveal("facilitator"),
      NOW,
    );
    expect(reduce(first.state, reveal("facilitator"), NOW)).toEqual(rejected("INVALID_STATE"));
  });

  it("rejects a reveal for a round that is no longer current", () => {
    const room = buildVotingRoom({ votes: { "voter-1": "5" } });
    expect(reduce(room, reveal("facilitator", "old-round"), NOW)).toEqual(rejected("STALE_ROUND"));
  });

  it("rejects a reveal when no round is open", () => {
    expect(reduce(buildRoom(), reveal("facilitator"), NOW)).toEqual(rejected("INVALID_STATE"));
  });

  it.each(["voter-1", "observer-1", "stranger"])("rejects a reveal by %s", (actorId) => {
    const room = buildVotingRoom({ observers: 1, votes: { "voter-1": "5" } });
    expect(reduce(room, reveal(actorId), NOW)).toEqual(rejected("FORBIDDEN"));
  });
});
