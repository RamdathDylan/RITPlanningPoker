import { describe, expect, it } from "vitest";
import { roomReducer } from "./room-state.js";

const dana = { id: "dana", displayName: "Dana", role: "voter", connected: true, hasVoted: false };
const riley = {
  id: "riley",
  displayName: "Riley",
  role: "voter",
  connected: true,
  hasVoted: false,
};
const story = { id: "s1", title: "Login", position: 0, status: "pending", finalEstimate: null };

function snapshot(overrides = {}) {
  return {
    room: {
      code: "ABCDEFGH",
      name: "Sprint 12",
      status: "voting",
      facilitatorId: "dana",
      currentStoryId: "s1",
    },
    participants: [dana, riley],
    stories: [story],
    round: { id: "r1", number: 1, revealed: false },
    me: { participantId: "riley", role: "voter", isFacilitator: false, myVote: null },
    ...overrides,
  };
}

const apply = (state, event, payload) => roomReducer(state, { event, payload });

describe("roomReducer", () => {
  it("replaces everything with a room:state snapshot", () => {
    expect(apply(null, "room:state", snapshot())).toEqual(snapshot());
  });

  it("updates participants and recomputes my role and facilitator flag", () => {
    const next = apply(snapshot(), "participant:update", {
      participants: [dana, { ...riley, role: "observer" }],
      facilitatorId: "riley",
    });

    expect(next.participants[1].role).toBe("observer");
    expect(next.room.facilitatorId).toBe("riley");
    expect(next.me).toMatchObject({ role: "observer", isFacilitator: true });
  });

  it("marks who has voted for the current round", () => {
    const next = apply(snapshot(), "vote:status", { roundId: "r1", votedIds: ["dana"] });
    expect(next.participants.map((participant) => participant.hasVoted)).toEqual([true, false]);
  });

  it("ignores vote status for a round that is no longer current", () => {
    const state = snapshot();
    expect(apply(state, "vote:status", { roundId: "old", votedIds: ["dana"] })).toBe(state);
  });

  it("starts a new round from story:update and forgets my old vote", () => {
    const state = snapshot({ me: { ...snapshot().me, myVote: "5" } });

    const next = apply(state, "story:update", {
      stories: [story],
      currentStoryId: "s1",
      status: "voting",
      round: { id: "r2", number: 2 },
    });

    expect(next.round).toEqual({ id: "r2", number: 2, revealed: false });
    expect(next.me.myVote).toBeNull();
    expect(next.participants.every((participant) => !participant.hasVoted)).toBe(true);
  });

  it("keeps my vote when story:update doesn't change the round", () => {
    const state = snapshot({ me: { ...snapshot().me, myVote: "5" } });
    const next = apply(state, "story:update", {
      stories: [story, { ...story, id: "s2", position: 1, title: "Signup" }],
      currentStoryId: "s1",
      status: "voting",
      round: { id: "r1", number: 1 },
    });
    expect(next.me.myVote).toBe("5");
    expect(next.stories).toHaveLength(2);
  });

  it("clears the round when the room returns to idle", () => {
    const next = apply(snapshot(), "story:update", {
      stories: [{ ...story, status: "estimated", finalEstimate: "5" }],
      currentStoryId: null,
      status: "idle",
      round: null,
    });
    expect(next.round).toBeNull();
    expect(next.room).toMatchObject({ status: "idle", currentStoryId: null });
  });

  it("shows revealed votes and stats", () => {
    const votes = [{ participantId: "dana", value: "5" }];
    const stats = { mean: 5 };

    const next = apply(snapshot(), "round:revealed", { roundId: "r1", votes, stats });

    expect(next.room.status).toBe("revealed");
    expect(next.round).toEqual({ id: "r1", number: 1, revealed: true, votes, stats });
  });

  it("marks the room ended", () => {
    const next = apply(snapshot(), "room:ended", {});
    expect(next.room.status).toBe("ended");
    expect(next.round).toBeNull();
  });

  it("records my own vote after the server accepts it", () => {
    expect(apply(snapshot(), "local:myVote", { value: "8" }).me.myVote).toBe("8");
    expect(apply(snapshot(), "local:myVote", { value: null }).me.myVote).toBeNull();
  });

  it("ignores updates that arrive before the first snapshot", () => {
    expect(apply(null, "vote:status", { roundId: "r1", votedIds: [] })).toBeNull();
  });

  it("ignores unknown events", () => {
    const state = snapshot();
    expect(apply(state, "something:else", {})).toBe(state);
  });
});
