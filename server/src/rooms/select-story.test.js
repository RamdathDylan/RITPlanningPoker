import { describe, expect, it } from "vitest";
import { NOW, buildRoom, buildStory, buildVotingRoom } from "../../test/builders.js";
import { assertInvariants } from "../../test/invariants.js";
import { reduce } from "./reduce.js";

const select = (actorId, storyId, roundId = "round-new") => ({
  type: "storySelected",
  actorId,
  storyId,
  roundId,
});

function accepted(result) {
  expect(result.ok, `rejected with ${result.code}`).toBe(true);
  assertInvariants(result.state);
  return result.state;
}

const roomWithBacklog = (overrides = {}) =>
  buildRoom({
    stories: [
      buildStory("s1", { position: 0 }),
      buildStory("s2", { position: 1, status: "estimated", finalEstimate: "5", roundCount: 2 }),
    ],
    ...overrides,
  });

describe("storySelected", () => {
  it("starts round 1 for a fresh story and moves the room to voting", () => {
    const state = accepted(reduce(roomWithBacklog(), select("facilitator", "s1"), NOW));

    expect(state.status).toBe("voting");
    expect(state.currentStoryId).toBe("s1");
    expect(state.round).toEqual({
      id: "round-new",
      storyId: "s1",
      number: 1,
      votes: {},
      revealedAt: null,
    });
    expect(state.stories[0].roundCount).toBe(1);
  });

  it("abandons the open round when another story is selected mid-vote", () => {
    const room = buildVotingRoom({ votes: { "voter-1": "5" } });
    const withSecondStory = buildRoom({
      ...room,
      stories: [...room.stories, buildStory("s2", { position: 1 })],
    });

    const state = accepted(reduce(withSecondStory, select("facilitator", "s2"), NOW));

    expect(state.round).toMatchObject({ id: "round-new", storyId: "s2", votes: {} });
  });

  it("continues round numbering when an estimated story is selected again", () => {
    const state = accepted(reduce(roomWithBacklog(), select("facilitator", "s2"), NOW));
    expect(state.round.number).toBe(3);
    expect(state.stories[1].roundCount).toBe(3);
  });

  it("works after a reveal", () => {
    const revealed = buildVotingRoom({ votes: { "voter-1": "5" } });
    const room = buildRoom({
      ...revealed,
      status: "revealed",
      round: { ...revealed.round, revealedAt: NOW },
    });
    accepted(reduce(room, select("facilitator", "s1"), NOW));
  });

  it("rejects an unknown story", () => {
    expect(reduce(roomWithBacklog(), select("facilitator", "nope"), NOW)).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it.each(["voter-1", "stranger"])("rejects selection by %s", (actorId) => {
    expect(reduce(roomWithBacklog(), select(actorId, "s1"), NOW)).toEqual({
      ok: false,
      code: "FORBIDDEN",
    });
  });

  it("rejects selection in an ended room", () => {
    expect(reduce(roomWithBacklog({ status: "ended" }), select("facilitator", "s1"), NOW)).toEqual({
      ok: false,
      code: "INVALID_STATE",
    });
  });
});
