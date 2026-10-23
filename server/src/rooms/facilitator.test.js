import { describe, expect, it } from "vitest";
import {
  NOW,
  buildParticipant,
  buildRoom,
  buildVotingRoom,
  deepFreeze,
} from "../../test/builders.js";
import { assertInvariants } from "../../test/invariants.js";
import { reduce } from "./reduce.js";

const HANDOFF_MS = 60_000;
const transfer = (actorId, participantId) => ({
  type: "facilitatorTransferred",
  actorId,
  participantId,
});
const handoff = () => ({ type: "facilitatorHandoff", delayMs: HANDOFF_MS });
const end = (actorId) => ({ type: "roomEnded", actorId });
const rejected = (code) => ({ ok: false, code });

function accepted(result) {
  expect(result.ok, `rejected with ${result.code}`).toBe(true);
  assertInvariants(result.state);
  return result.state;
}

// Facilitator went offline at NOW. "early-offline" joined first but is also offline.
const awayRoom = (overrides = {}) =>
  buildRoom({
    participants: deepFreeze([
      buildParticipant("facilitator", { joinedAt: NOW, connected: false, disconnectedAt: NOW }),
      buildParticipant("early-offline", {
        joinedAt: NOW + 1,
        connected: false,
        disconnectedAt: NOW,
      }),
      buildParticipant("later-online", { joinedAt: NOW + 3 }),
      buildParticipant("earlier-online", { joinedAt: NOW + 2 }),
    ]),
    ...overrides,
  });

describe("facilitatorTransferred", () => {
  it("hands control to another participant", () => {
    expect(
      accepted(reduce(buildRoom(), transfer("facilitator", "voter-2"), NOW)).facilitatorId,
    ).toBe("voter-2");
  });

  it.each([
    ["themselves", "facilitator"],
    ["someone not in the room", "stranger"],
  ])("rejects transferring to %s", (_label, target) => {
    expect(reduce(buildRoom(), transfer("facilitator", target), NOW)).toEqual(
      rejected("INVALID_TARGET"),
    );
  });

  it("rejects a transfer by a non-facilitator", () => {
    expect(reduce(buildRoom(), transfer("voter-1", "voter-1"), NOW)).toEqual(rejected("FORBIDDEN"));
  });
});

describe("facilitatorHandoff", () => {
  it("passes control to the earliest-joined connected participant after 60 seconds", () => {
    const state = accepted(reduce(awayRoom(), handoff(), NOW + HANDOFF_MS));
    expect(state.facilitatorId).toBe("earlier-online");
  });

  it("does nothing at 59.999 seconds", () => {
    const state = accepted(reduce(awayRoom(), handoff(), NOW + HANDOFF_MS - 1));
    expect(state.facilitatorId).toBe("facilitator");
  });

  it("does nothing if the facilitator has reconnected", () => {
    const state = accepted(reduce(buildRoom(), handoff(), NOW + HANDOFF_MS * 2));
    expect(state.facilitatorId).toBe("facilitator");
  });

  it("does nothing when nobody else is connected", () => {
    const room = buildRoom({
      participants: deepFreeze([
        buildParticipant("facilitator", { connected: false, disconnectedAt: NOW }),
        buildParticipant("voter-1", { joinedAt: NOW + 1, connected: false, disconnectedAt: NOW }),
      ]),
    });
    expect(accepted(reduce(room, handoff(), NOW + HANDOFF_MS)).facilitatorId).toBe("facilitator");
  });
});

describe("roomEnded", () => {
  it("ends the room and closes any open round", () => {
    const state = accepted(
      reduce(buildVotingRoom({ votes: { "voter-1": "5" } }), end("facilitator"), NOW),
    );
    expect(state).toMatchObject({ status: "ended", round: null, currentStoryId: null });
  });

  it("rejects ending by a non-facilitator", () => {
    expect(reduce(buildRoom(), end("voter-1"), NOW)).toEqual(rejected("FORBIDDEN"));
  });

  it.each([
    ["storiesAdded", { actorId: "facilitator", stories: [{ id: "x", title: "Late" }] }],
    ["storySelected", { actorId: "facilitator", storyId: "s1", roundId: "r9" }],
    ["voteCast", { actorId: "voter-1", roundId: "r1", value: "5" }],
    ["roundRevealed", { actorId: "facilitator", roundId: "r1" }],
    ["roleChanged", { actorId: "voter-1", role: "observer" }],
    ["participantJoined", { participant: { id: "n", displayName: "New", role: "voter" } }],
    ["facilitatorTransferred", { actorId: "facilitator", participantId: "voter-1" }],
    ["roomEnded", { actorId: "facilitator" }],
  ])("makes %s fail afterwards", (type, fields) => {
    const ended = accepted(
      reduce(buildVotingRoom({ votes: { "voter-1": "5" } }), end("facilitator"), NOW),
    );
    expect(reduce(ended, { type, ...fields }, NOW)).toEqual(rejected("INVALID_STATE"));
  });
});
