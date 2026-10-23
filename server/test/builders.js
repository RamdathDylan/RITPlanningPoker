import { LIMITS } from "../../shared/events.js";

export const NOW = 1_800_000_000_000;

// Freezing every level makes any accidental mutation inside the reducer throw (ES modules
// run in strict mode), which proves reduce() returns new objects instead of editing input.
export function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

export function buildParticipant(id, overrides = {}) {
  return {
    id,
    displayName: overrides.displayName ?? id,
    role: "voter",
    joinedAt: NOW,
    connected: true,
    connectedAt: NOW,
    disconnectedAt: null,
    ...overrides,
  };
}

// A room with a facilitator ("facilitator") plus `voters` voters ("voter-1", ...) and
// `observers` observers ("observer-1", ...), joined one millisecond apart in that order.
export function buildRoom({ voters = 2, observers = 0, ...overrides } = {}) {
  const ids = [
    "facilitator",
    ...Array.from({ length: voters }, (_, index) => `voter-${index + 1}`),
    ...Array.from({ length: observers }, (_, index) => `observer-${index + 1}`),
  ];
  const participants = ids.map((id, index) =>
    buildParticipant(id, {
      role: id.startsWith("observer") ? "observer" : "voter",
      joinedAt: NOW + index,
    }),
  );
  return deepFreeze({
    id: "room-1",
    code: "ABCDEFGH",
    name: "Sprint 12",
    status: "idle",
    facilitatorId: "facilitator",
    participants,
    stories: [],
    currentStoryId: null,
    round: null,
    ...overrides,
  });
}

export function fullRoom() {
  return buildRoom({ voters: LIMITS.participantsPerRoom - 1 });
}

export function buildStory(id, overrides = {}) {
  return {
    id,
    title: `Story ${id}`,
    position: 0,
    status: "pending",
    finalEstimate: null,
    roundCount: 0,
    ...overrides,
  };
}

// A room voting on story "s1" in round "r1" with the given votes ({ participantId: card }).
export function buildVotingRoom({ votes = {}, ...roomOptions } = {}) {
  return buildRoom({
    status: "voting",
    stories: [buildStory("s1", { roundCount: 1 })],
    currentStoryId: "s1",
    round: { id: "r1", storyId: "s1", number: 1, votes, revealedAt: null },
    ...roomOptions,
  });
}
