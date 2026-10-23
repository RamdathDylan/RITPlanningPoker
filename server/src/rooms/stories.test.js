import { describe, expect, it } from "vitest";
import { NOW, buildRoom, buildStory, buildVotingRoom } from "../../test/builders.js";
import { assertInvariants } from "../../test/invariants.js";
import { reduce } from "./reduce.js";

const add = (actorId, titles) => ({
  type: "storiesAdded",
  actorId,
  stories: titles.map((title, index) => ({ id: `new-${index}`, title })),
});

function accepted(result) {
  expect(result.ok, `rejected with ${result.code}`).toBe(true);
  assertInvariants(result.state);
  return result.state;
}

const roomWithStories = (count, overrides = {}) =>
  buildRoom({
    stories: Array.from({ length: count }, (_, index) =>
      buildStory(`s${index}`, { position: index }),
    ),
    ...overrides,
  });

describe("storiesAdded", () => {
  it("lets the facilitator add pending stories in order", () => {
    const state = accepted(
      reduce(buildRoom(), add("facilitator", ["Login", "Signup", "Reset"]), NOW),
    );

    expect(state.stories).toEqual([
      {
        id: "new-0",
        title: "Login",
        position: 0,
        status: "pending",
        finalEstimate: null,
        roundCount: 0,
      },
      {
        id: "new-1",
        title: "Signup",
        position: 1,
        status: "pending",
        finalEstimate: null,
        roundCount: 0,
      },
      {
        id: "new-2",
        title: "Reset",
        position: 2,
        status: "pending",
        finalEstimate: null,
        roundCount: 0,
      },
    ]);
  });

  it("continues positions after existing stories", () => {
    const state = accepted(reduce(roomWithStories(2), add("facilitator", ["Next"]), NOW));
    expect(state.stories.at(-1)).toMatchObject({ id: "new-0", position: 2 });
  });

  it("allows adding while a round is in progress without changing the round", () => {
    const room = buildVotingRoom({ votes: { "voter-1": "5" } });
    const state = accepted(reduce(room, add("facilitator", ["Later"]), NOW));
    expect(state.status).toBe("voting");
    expect(state.round).toEqual(room.round);
  });

  it("allows filling the room to exactly 200 stories", () => {
    const state = accepted(reduce(roomWithStories(199), add("facilitator", ["Last"]), NOW));
    expect(state.stories).toHaveLength(200);
  });

  it("rejects the whole batch if it would pass 200 stories", () => {
    expect(reduce(roomWithStories(199), add("facilitator", ["One", "Two"]), NOW)).toEqual({
      ok: false,
      code: "STORY_LIMIT",
    });
  });

  it.each(["voter-1", "observer-1", "stranger"])("rejects stories added by %s", (actorId) => {
    expect(reduce(buildRoom({ observers: 1 }), add(actorId, ["Sneaky"]), NOW)).toEqual({
      ok: false,
      code: "FORBIDDEN",
    });
  });

  it("rejects adding stories to an ended room", () => {
    expect(reduce(buildRoom({ status: "ended" }), add("facilitator", ["Late"]), NOW)).toEqual({
      ok: false,
      code: "INVALID_STATE",
    });
  });
});
