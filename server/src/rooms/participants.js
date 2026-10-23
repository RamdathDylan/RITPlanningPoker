import { LIMITS } from "../../../shared/events.js";
import { accept, reject } from "./results.js";
import { chooseSuccessor, createParticipant, findParticipant, withoutVote } from "./state.js";

const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

export function participantJoined(state, { participant }, now) {
  if (state.status === "ended") {
    return reject("INVALID_STATE");
  }
  if (state.participants.length >= LIMITS.participantsPerRoom) {
    return reject("ROOM_FULL");
  }
  if (state.participants.some((seated) => sameName(seated.displayName, participant.displayName))) {
    return reject("NAME_TAKEN");
  }
  return accept({
    ...state,
    participants: [...state.participants, createParticipant(participant, now)],
    facilitatorId: state.facilitatorId ?? participant.id,
  });
}

export function participantLeft(state, { actorId }) {
  if (!findParticipant(state, actorId)) {
    return reject("FORBIDDEN");
  }
  const participants = state.participants.filter((participant) => participant.id !== actorId);
  return accept({
    ...state,
    participants,
    facilitatorId:
      state.facilitatorId === actorId ? chooseSuccessor(participants) : state.facilitatorId,
    round: withoutVote(state.round, actorId),
  });
}
