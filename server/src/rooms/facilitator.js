import { accept, reject } from "./results.js";
import { earliestConnected, findParticipant, isFacilitator } from "./state.js";

export function facilitatorTransferred(state, { actorId, participantId }) {
  if (!isFacilitator(state, actorId)) {
    return reject("FORBIDDEN");
  }
  if (state.status === "ended") {
    return reject("INVALID_STATE");
  }
  if (participantId === actorId || !findParticipant(state, participantId)) {
    return reject("INVALID_TARGET");
  }
  return accept({ ...state, facilitatorId: participantId });
}

// Sent by the server's timer. It re-checks everything, because the facilitator may have
// reconnected (or the delay not yet passed) by the time the timer fires.
export function facilitatorHandoff(state, { delayMs }, now) {
  if (state.status === "ended") {
    return reject("INVALID_STATE");
  }
  const facilitator = findParticipant(state, state.facilitatorId);
  const awayLongEnough =
    facilitator && !facilitator.connected && now - facilitator.disconnectedAt >= delayMs;
  const successor = awayLongEnough ? earliestConnected(state.participants) : null;
  return accept(successor ? { ...state, facilitatorId: successor.id } : state);
}

export function roomEnded(state, { actorId }) {
  if (!isFacilitator(state, actorId)) {
    return reject("FORBIDDEN");
  }
  if (state.status === "ended") {
    return reject("INVALID_STATE");
  }
  return accept({ ...state, status: "ended", currentStoryId: null, round: null });
}
