import { expect } from "vitest";
import { LIMITS } from "../../shared/events.js";

// Rules that must hold after every successful reduction (docs/testing-strategy.md section 3).
export function assertInvariants(state) {
  const ids = state.participants.map((participant) => participant.id);
  const names = state.participants.map((participant) => participant.displayName.toLowerCase());

  expect(new Set(ids).size, "participant ids are unique").toBe(ids.length);
  expect(new Set(names).size, "names are unique ignoring case").toBe(names.length);
  expect(ids.length, "seat cap").toBeLessThanOrEqual(LIMITS.participantsPerRoom);
  expect(state.stories.length, "story cap").toBeLessThanOrEqual(LIMITS.storiesPerRoom);

  if (ids.length === 0) {
    expect(state.facilitatorId, "empty room has no facilitator").toBeNull();
  } else {
    expect(ids, "facilitator is seated").toContain(state.facilitatorId);
  }

  if (state.status === "voting") {
    expect(state.round, "voting has a round").not.toBeNull();
    expect(state.round.revealedAt, "voting round is hidden").toBeNull();
    expect(state.currentStoryId, "voting round is for the current story").toBe(state.round.storyId);
  }
  if (state.status === "revealed") {
    expect(state.round?.revealedAt, "revealed round has a reveal time").not.toBeNull();
  }
  if (state.status === "idle") {
    expect(state.round, "idle has no open round").toBeNull();
  }

  for (const participantId of Object.keys(state.round?.votes ?? {})) {
    const voter = state.participants.find((participant) => participant.id === participantId);
    expect(voter?.role, "only seated voters have votes").toBe("voter");
  }
}
