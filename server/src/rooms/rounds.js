import { NUMERIC_CARDS } from "../../../shared/events.js";
import { accept, reject } from "./results.js";
import { isFacilitator } from "./state.js";

// Shared checks for facilitator round actions: who, when, and which round.
function checkFacilitatorRound(state, { actorId, roundId }, requiredStatus) {
  if (!isFacilitator(state, actorId)) {
    return reject("FORBIDDEN");
  }
  if (state.status !== requiredStatus) {
    return reject("INVALID_STATE");
  }
  if (state.round.id !== roundId) {
    return reject("STALE_ROUND");
  }
  return null;
}

export function roundRevealed(state, action, now) {
  const problem = checkFacilitatorRound(state, action, "voting");
  if (problem) {
    return problem;
  }
  if (Object.keys(state.round.votes).length === 0) {
    return reject("NO_VOTES");
  }
  return accept({ ...state, status: "revealed", round: { ...state.round, revealedAt: now } });
}

export function roundRevoted(state, action) {
  const problem = checkFacilitatorRound(state, action, "revealed");
  if (problem) {
    return problem;
  }
  const { storyId } = state.round;
  const number = state.round.number + 1;
  return accept({
    ...state,
    status: "voting",
    stories: state.stories.map((story) =>
      story.id === storyId ? { ...story, roundCount: number } : story,
    ),
    round: { id: action.newRoundId, storyId, number, votes: {}, revealedAt: null },
  });
}

export function estimateAccepted(state, { actorId, storyId, value }) {
  if (!isFacilitator(state, actorId)) {
    return reject("FORBIDDEN");
  }
  if (state.status !== "revealed" || state.currentStoryId !== storyId) {
    return reject("INVALID_STATE");
  }
  if (!NUMERIC_CARDS.includes(value)) {
    return reject("INVALID_PAYLOAD");
  }
  return accept({
    ...state,
    status: "idle",
    currentStoryId: null,
    round: null,
    stories: state.stories.map((story) =>
      story.id === storyId ? { ...story, status: "estimated", finalEstimate: value } : story,
    ),
  });
}
