import { FIBONACCI_DECK } from "../../../shared/events.js";
import { accept, reject } from "./results.js";
import { findParticipant, withoutVote } from "./state.js";

// Shared checks for voting actions, in order: who (seated voter), when (voting), which round.
function checkVoter(state, actorId, roundId) {
  if (findParticipant(state, actorId)?.role !== "voter") {
    return reject("FORBIDDEN");
  }
  if (state.status !== "voting") {
    return reject("INVALID_STATE");
  }
  if (state.round.id !== roundId) {
    return reject("STALE_ROUND");
  }
  return null;
}

export function voteCast(state, { actorId, roundId, value }) {
  const problem = checkVoter(state, actorId, roundId);
  if (problem) {
    return problem;
  }
  if (!FIBONACCI_DECK.includes(value)) {
    return reject("INVALID_PAYLOAD");
  }
  return accept({
    ...state,
    round: { ...state.round, votes: { ...state.round.votes, [actorId]: value } },
  });
}

export function voteCleared(state, { actorId, roundId }) {
  const problem = checkVoter(state, actorId, roundId);
  if (problem) {
    return problem;
  }
  if (!Object.hasOwn(state.round.votes, actorId)) {
    return reject("NO_VOTE");
  }
  return accept({ ...state, round: withoutVote(state.round, actorId) });
}
