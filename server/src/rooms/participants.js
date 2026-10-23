import { LIMITS, ROLES } from "../../../shared/events.js";
import { accept, reject } from "./results.js";
import {
  chooseSuccessor,
  createParticipant,
  findParticipant,
  isFacilitator,
  withoutVote,
} from "./state.js";

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

function updateParticipant(state, participantId, changes) {
  return {
    ...state,
    participants: state.participants.map((participant) =>
      participant.id === participantId ? { ...participant, ...changes } : participant,
    ),
  };
}

export function participantConnected(state, { participantId }, now) {
  if (!findParticipant(state, participantId)) {
    return reject("NOT_FOUND");
  }
  const next = updateParticipant(state, participantId, {
    connected: true,
    connectedAt: now,
    disconnectedAt: null,
  });
  const effects = state.facilitatorId === participantId ? [{ type: "cancelHandoff" }] : [];
  return accept(next, effects);
}

// Sent by the server only when a participant's last open socket closes.
// The seat and any vote are kept so a reconnect restores them.
export function participantDisconnected(state, { participantId }, now) {
  if (!findParticipant(state, participantId)) {
    return reject("NOT_FOUND");
  }
  const next = updateParticipant(state, participantId, { connected: false, disconnectedAt: now });
  const effects = state.facilitatorId === participantId ? [{ type: "scheduleHandoff" }] : [];
  return accept(next, effects);
}

export function roleChanged(state, { actorId, role }) {
  if (!findParticipant(state, actorId)) {
    return reject("FORBIDDEN");
  }
  if (!ROLES.includes(role)) {
    return reject("INVALID_PAYLOAD");
  }
  if (state.status === "ended") {
    return reject("INVALID_STATE");
  }
  const next = updateParticipant(state, actorId, { role });
  return accept(role === "observer" ? { ...next, round: withoutVote(next.round, actorId) } : next);
}

export function participantRemoved(state, { actorId, participantId }) {
  if (!isFacilitator(state, actorId)) {
    return reject("FORBIDDEN");
  }
  if (participantId === actorId || !findParticipant(state, participantId)) {
    return reject("INVALID_TARGET");
  }
  return accept(
    {
      ...state,
      participants: state.participants.filter((participant) => participant.id !== participantId),
      round: withoutVote(state.round, participantId),
    },
    [{ type: "disconnectParticipant", participantId, reason: "kicked" }],
  );
}
