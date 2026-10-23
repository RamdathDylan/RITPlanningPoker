import { describe, expect, it } from "vitest";
import { NOW, buildRoom, buildVotingRoom } from "../../test/builders.js";
import { findKeyDeep } from "../../test/helpers/recorder.js";
import { toPublicView, toViewerView } from "./projections.js";
import { computeStats } from "./stats.js";

// voter-1 voted "13", voter-2 voted "21": distinctive values that appear nowhere else.
const votingRoom = () =>
  buildVotingRoom({ observers: 1, votes: { "voter-1": "13", "voter-2": "21" } });

const revealedRoom = () => {
  const room = votingRoom();
  return buildRoom({ ...room, status: "revealed", round: { ...room.round, revealedAt: NOW } });
};

const LEAKY_KEYS = ["value", "votes", "joinedAt", "connectedAt", "disconnectedAt", "roundCount"];

describe("toPublicView while voting", () => {
  it("has exactly the public fields, with who has voted but not what", () => {
    expect(toPublicView(votingRoom())).toEqual({
      room: {
        code: "ABCDEFGH",
        name: "Sprint 12",
        status: "voting",
        facilitatorId: "facilitator",
        currentStoryId: "s1",
      },
      participants: [
        {
          id: "facilitator",
          displayName: "facilitator",
          role: "voter",
          connected: true,
          hasVoted: false,
        },
        { id: "voter-1", displayName: "voter-1", role: "voter", connected: true, hasVoted: true },
        { id: "voter-2", displayName: "voter-2", role: "voter", connected: true, hasVoted: true },
        {
          id: "observer-1",
          displayName: "observer-1",
          role: "observer",
          connected: true,
          hasVoted: false,
        },
      ],
      stories: [
        { id: "s1", title: "Story s1", position: 0, status: "pending", finalEstimate: null },
      ],
      round: { id: "r1", number: 1, revealed: false },
    });
  });

  it.each(LEAKY_KEYS)("contains no %s key at any depth", (key) => {
    expect(findKeyDeep(toPublicView(votingRoom()), key)).toEqual([]);
  });

  it("contains neither vote value anywhere in its JSON", () => {
    const json = JSON.stringify(toPublicView(votingRoom()));
    expect(json).not.toContain('"13"');
    expect(json).not.toContain('"21"');
  });
});

describe("toViewerView while voting", () => {
  it("adds only the viewer's own vote", () => {
    const view = toViewerView(votingRoom(), "voter-1");

    expect(view.me).toEqual({
      participantId: "voter-1",
      role: "voter",
      isFacilitator: false,
      myVote: "13",
    });
    expect(JSON.stringify(view)).not.toContain('"21"');
    expect(findKeyDeep(view, "value")).toEqual([]);
  });

  it("gives an observer no vote", () => {
    expect(toViewerView(votingRoom(), "observer-1").me).toEqual({
      participantId: "observer-1",
      role: "observer",
      isFacilitator: false,
      myVote: null,
    });
  });

  it("marks the facilitator", () => {
    expect(toViewerView(votingRoom(), "facilitator").me.isFacilitator).toBe(true);
  });
});

describe("views after the reveal", () => {
  it.each([
    ["public", (state) => toPublicView(state)],
    ["viewer", (state) => toViewerView(state, "observer-1")],
  ])("the %s view includes every vote in seat order", (_label, view) => {
    expect(view(revealedRoom()).round).toEqual({
      id: "r1",
      number: 1,
      revealed: true,
      votes: [
        { participantId: "voter-1", value: "13" },
        { participantId: "voter-2", value: "21" },
      ],
      stats: computeStats(["13", "21"]),
    });
  });
});

describe("views with no round", () => {
  it("have a null round and nobody marked as voted", () => {
    const view = toPublicView(buildRoom());
    expect(view.round).toBeNull();
    expect(view.participants.every((participant) => participant.hasVoted === false)).toBe(true);
  });
});
