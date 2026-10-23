import { describe, expect, it } from "vitest";
import { NOW, buildRoom, buildVotingRoom } from "../../test/builders.js";
import { assertInvariants } from "../../test/invariants.js";
import { reduce } from "./reduce.js";

const setRole = (actorId, role) => ({ type: "roleChanged", actorId, role });
const remove = (actorId, participantId) => ({ type: "participantRemoved", actorId, participantId });

function accepted(result) {
  expect(result.ok, `rejected with ${result.code}`).toBe(true);
  assertInvariants(result.state);
  return result;
}

const roleOf = (state, id) => state.participants.find((participant) => participant.id === id).role;

describe("roleChanged", () => {
  it("lets a voter become an observer and drops their open vote", () => {
    const room = buildVotingRoom({ votes: { "voter-1": "5", "voter-2": "3" } });
    const { state } = accepted(reduce(room, setRole("voter-1", "observer"), NOW));

    expect(roleOf(state, "voter-1")).toBe("observer");
    expect(state.round.votes).toEqual({ "voter-2": "3" });
  });

  it("lets an observer become a voter", () => {
    const { state } = accepted(
      reduce(buildRoom({ observers: 1 }), setRole("observer-1", "voter"), NOW),
    );
    expect(roleOf(state, "observer-1")).toBe("voter");
  });

  it("lets the facilitator switch to observer and stay facilitator", () => {
    const { state } = accepted(reduce(buildRoom(), setRole("facilitator", "observer"), NOW));
    expect(state.facilitatorId).toBe("facilitator");
    expect(roleOf(state, "facilitator")).toBe("observer");
  });

  it("rejects a role that doesn't exist", () => {
    expect(reduce(buildRoom(), setRole("voter-1", "facilitator"), NOW)).toEqual({
      ok: false,
      code: "INVALID_PAYLOAD",
    });
  });

  it("rejects someone who isn't seated", () => {
    expect(reduce(buildRoom(), setRole("stranger", "voter"), NOW)).toEqual({
      ok: false,
      code: "FORBIDDEN",
    });
  });

  it("rejects changes in an ended room", () => {
    expect(reduce(buildRoom({ status: "ended" }), setRole("voter-1", "observer"), NOW)).toEqual({
      ok: false,
      code: "INVALID_STATE",
    });
  });
});

describe("participantRemoved", () => {
  it("lets the facilitator remove a participant, their vote, and their connection", () => {
    const room = buildVotingRoom({ votes: { "voter-1": "5", "voter-2": "3" } });
    const { state, effects } = accepted(reduce(room, remove("facilitator", "voter-1"), NOW));

    expect(state.participants.map((participant) => participant.id)).not.toContain("voter-1");
    expect(state.round.votes).toEqual({ "voter-2": "3" });
    expect(effects).toEqual([
      { type: "disconnectParticipant", participantId: "voter-1", reason: "kicked" },
    ]);
  });

  it.each([
    ["themselves", "facilitator"],
    ["someone who isn't in the room", "stranger"],
  ])("rejects the facilitator removing %s", (_label, target) => {
    expect(reduce(buildRoom(), remove("facilitator", target), NOW)).toEqual({
      ok: false,
      code: "INVALID_TARGET",
    });
  });

  it.each(["voter-2", "observer-1", "stranger"])("rejects removal requested by %s", (actorId) => {
    expect(reduce(buildRoom({ observers: 1 }), remove(actorId, "voter-1"), NOW)).toEqual({
      ok: false,
      code: "FORBIDDEN",
    });
  });
});
