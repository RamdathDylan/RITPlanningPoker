import { describe, expect, it } from "vitest";
import { NOW, buildParticipant, buildRoom, deepFreeze, fullRoom } from "../../test/builders.js";
import { assertInvariants } from "../../test/invariants.js";
import { reduce } from "./reduce.js";
import { createRoomState } from "./state.js";

function expectAccepted(result) {
  expect(result.ok, `rejected with ${result.code}`).toBe(true);
  assertInvariants(result.state);
  return result.state;
}

const join = (participant) => ({ type: "participantJoined", participant });
const leave = (actorId) => ({ type: "participantLeft", actorId });

describe("createRoomState", () => {
  it("seats the creator as a disconnected voter who is the facilitator", () => {
    const state = createRoomState({
      id: "room-1",
      code: "ABCDEFGH",
      name: "Sprint 12",
      facilitator: { id: "p-1", displayName: "Dana" },
      now: NOW,
    });

    expect(state).toEqual({
      id: "room-1",
      code: "ABCDEFGH",
      name: "Sprint 12",
      status: "idle",
      facilitatorId: "p-1",
      participants: [
        {
          id: "p-1",
          displayName: "Dana",
          role: "voter",
          joinedAt: NOW,
          connected: false,
          connectedAt: null,
          disconnectedAt: null,
        },
      ],
      stories: [],
      currentStoryId: null,
      round: null,
    });
    assertInvariants(state);
  });
});

describe("participantJoined", () => {
  it("adds a disconnected seat at the end", () => {
    const state = expectAccepted(
      reduce(buildRoom(), join({ id: "new", displayName: "Riley", role: "observer" }), NOW + 50),
    );

    expect(state.participants.at(-1)).toEqual({
      id: "new",
      displayName: "Riley",
      role: "observer",
      joinedAt: NOW + 50,
      connected: false,
      connectedAt: null,
      disconnectedAt: null,
    });
  });

  it("rejects the 51st seat", () => {
    const result = reduce(
      fullRoom(),
      join({ id: "late", displayName: "Late", role: "voter" }),
      NOW,
    );
    expect(result).toEqual({ ok: false, code: "ROOM_FULL" });
  });

  it("rejects a name already used in the room, ignoring case", () => {
    const room = buildRoom({
      participants: deepFreeze([buildParticipant("a", { displayName: "Alex" })]),
      facilitatorId: "a",
    });
    const result = reduce(room, join({ id: "b", displayName: "ALEX", role: "voter" }), NOW);
    expect(result).toEqual({ ok: false, code: "NAME_TAKEN" });
  });

  it("rejects joining an ended room", () => {
    const result = reduce(
      buildRoom({ status: "ended" }),
      join({ id: "b", displayName: "Bo", role: "voter" }),
      NOW,
    );
    expect(result).toEqual({ ok: false, code: "INVALID_STATE" });
  });

  it("makes the first person into an empty room the facilitator", () => {
    const empty = buildRoom({ participants: [], facilitatorId: null });
    const state = expectAccepted(
      reduce(empty, join({ id: "b", displayName: "Bo", role: "voter" }), NOW),
    );
    expect(state.facilitatorId).toBe("b");
  });
});

describe("participantLeft", () => {
  it("removes the seat", () => {
    const state = expectAccepted(reduce(buildRoom(), leave("voter-1"), NOW));
    expect(state.participants.map((participant) => participant.id)).toEqual([
      "facilitator",
      "voter-2",
    ]);
  });

  it("removes the leaver's vote from the open round", () => {
    const room = buildRoom({
      status: "voting",
      stories: [
        {
          id: "s1",
          title: "Login",
          position: 0,
          status: "pending",
          finalEstimate: null,
          roundCount: 1,
        },
      ],
      currentStoryId: "s1",
      round: {
        id: "r1",
        storyId: "s1",
        number: 1,
        votes: { "voter-1": "5", "voter-2": "8" },
        revealedAt: null,
      },
    });
    const state = expectAccepted(reduce(room, leave("voter-1"), NOW));
    expect(state.round.votes).toEqual({ "voter-2": "8" });
  });

  it("hands control to the earliest-joined connected participant when the facilitator leaves", () => {
    const room = buildRoom({
      participants: deepFreeze([
        buildParticipant("facilitator", { joinedAt: NOW }),
        buildParticipant("offline", { joinedAt: NOW + 1, connected: false }),
        buildParticipant("online", { joinedAt: NOW + 2 }),
      ]),
    });
    expect(expectAccepted(reduce(room, leave("facilitator"), NOW)).facilitatorId).toBe("online");
  });

  it("falls back to the earliest-joined participant when nobody else is connected", () => {
    const room = buildRoom({
      participants: deepFreeze([
        buildParticipant("facilitator", { joinedAt: NOW }),
        buildParticipant("later", { joinedAt: NOW + 2, connected: false }),
        buildParticipant("earlier", { joinedAt: NOW + 1, connected: false }),
      ]),
    });
    expect(expectAccepted(reduce(room, leave("facilitator"), NOW)).facilitatorId).toBe("earlier");
  });

  it("leaves no facilitator when the last person leaves", () => {
    const room = buildRoom({ voters: 0 });
    expect(expectAccepted(reduce(room, leave("facilitator"), NOW)).facilitatorId).toBeNull();
  });

  it("rejects a leave from someone who isn't seated", () => {
    expect(reduce(buildRoom(), leave("stranger"), NOW)).toEqual({ ok: false, code: "FORBIDDEN" });
  });
});

describe("reduce", () => {
  it("rejects unknown action types", () => {
    expect(reduce(buildRoom(), { type: "makeMeAdmin" }, NOW)).toEqual({
      ok: false,
      code: "INVALID_PAYLOAD",
    });
  });

  it("never mutates the state it was given (inputs are deeply frozen)", () => {
    const room = buildRoom();
    expect(() => reduce(room, leave("voter-1"), NOW)).not.toThrow();
    expect(room.participants).toHaveLength(3);
  });
});
