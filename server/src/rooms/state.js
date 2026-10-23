export function createParticipant({ id, displayName, role }, now) {
  return {
    id,
    displayName,
    role,
    joinedAt: now,
    connected: false,
    connectedAt: null,
    disconnectedAt: null,
  };
}

export function createRoomState({ id, code, name, facilitator, now }) {
  return {
    id,
    code,
    name,
    status: "idle",
    facilitatorId: facilitator.id,
    participants: [createParticipant({ ...facilitator, role: "voter" }, now)],
    stories: [],
    currentStoryId: null,
    round: null,
  };
}

export function findParticipant(state, participantId) {
  return state.participants.find((participant) => participant.id === participantId);
}

// Checked against server state on every facilitator action; never trusted from the client.
export function isFacilitator(state, participantId) {
  return state.facilitatorId === participantId && Boolean(findParticipant(state, participantId));
}

function earliestJoined(participants) {
  return participants.reduce(
    (earliest, participant) =>
      earliest === null || participant.joinedAt < earliest.joinedAt ? participant : earliest,
    null,
  );
}

export function earliestConnected(participants) {
  return earliestJoined(participants.filter((participant) => participant.connected));
}

// Who takes over when the facilitator leaves: the earliest-joined connected participant,
// otherwise the earliest-joined participant, otherwise nobody (empty room).
export function chooseSuccessor(participants) {
  const successor = earliestConnected(participants) ?? earliestJoined(participants);
  return successor?.id ?? null;
}

export function withoutVote(round, participantId) {
  if (!round || !Object.hasOwn(round.votes, participantId)) {
    return round;
  }
  const votes = Object.fromEntries(
    Object.entries(round.votes).filter(([voterId]) => voterId !== participantId),
  );
  return { ...round, votes };
}
