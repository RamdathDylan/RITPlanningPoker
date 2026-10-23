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
