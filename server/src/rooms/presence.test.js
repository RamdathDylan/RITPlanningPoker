import { describe, expect, it } from "vitest";
import { NOW, buildParticipant, buildRoom, deepFreeze } from "../../test/builders.js";
import { assertInvariants } from "../../test/invariants.js";
import { reduce } from "./reduce.js";

const connected = (participantId) => ({ type: "participantConnected", participantId });
const disconnected = (participantId) => ({ type: "participantDisconnected", participantId });

function accepted(result) {
  expect(result.ok, `rejected with ${result.code}`).toBe(true);
  assertInvariants(result.state);
  return result;
}

const offlineRoom = () =>
  buildRoom({
    participants: deepFreeze([
      buildParticipant("facilitator", { connected: false, connectedAt: null, disconnectedAt: NOW }),
      buildParticipant("voter-1", { connected: false, connectedAt: null, joinedAt: NOW + 1 }),
    ]),
  });

describe("participantConnected", () => {
  it("marks the participant connected and records when", () => {
    const { state, effects } = accepted(reduce(offlineRoom(), connected("voter-1"), NOW + 500));

    expect(state.participants[1]).toMatchObject({
      connected: true,
      connectedAt: NOW + 500,
      disconnectedAt: null,
    });
    expect(effects).toEqual([]);
  });

  it("cancels a pending handoff when the facilitator comes back", () => {
    const { effects } = accepted(reduce(offlineRoom(), connected("facilitator"), NOW + 500));
    expect(effects).toEqual([{ type: "cancelHandoff" }]);
  });

  it("works in an ended room so people can still see the summary", () => {
    const ended = buildRoom({ ...offlineRoom(), status: "ended" });
    accepted(reduce(ended, connected("voter-1"), NOW));
  });

  it("rejects an unknown participant", () => {
    expect(reduce(offlineRoom(), connected("ghost"), NOW)).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});

describe("participantDisconnected", () => {
  it("marks the participant disconnected and records when", () => {
    const { state, effects } = accepted(reduce(buildRoom(), disconnected("voter-1"), NOW + 900));

    expect(state.participants[1]).toMatchObject({ connected: false, disconnectedAt: NOW + 900 });
    expect(effects).toEqual([]);
  });

  it("schedules a handoff when the facilitator disconnects", () => {
    const { effects } = accepted(reduce(buildRoom(), disconnected("facilitator"), NOW));
    expect(effects).toEqual([{ type: "scheduleHandoff" }]);
  });

  it("keeps the participant's vote while they are away", () => {
    const voting = buildRoom({
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
      round: { id: "r1", storyId: "s1", number: 1, votes: { "voter-1": "5" }, revealedAt: null },
    });
    const { state } = accepted(reduce(voting, disconnected("voter-1"), NOW));
    expect(state.round.votes).toEqual({ "voter-1": "5" });
  });

  it("rejects an unknown participant", () => {
    expect(reduce(buildRoom(), disconnected("ghost"), NOW)).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});
