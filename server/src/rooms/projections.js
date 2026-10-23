// The only functions whose output may be sent to clients (CLAUDE.md security rules 1 and 15).
// Each field is copied explicitly, so adding something to room state never leaks by accident.

function hasVoted(round, participantId) {
  return Boolean(round) && Object.hasOwn(round.votes, participantId);
}

function publicRound(state) {
  const { round } = state;
  if (!round) {
    return null;
  }
  const revealed = round.revealedAt !== null;
  if (!revealed) {
    return { id: round.id, number: round.number, revealed };
  }
  const votes = state.participants
    .filter((participant) => hasVoted(round, participant.id))
    .map((participant) => ({ participantId: participant.id, value: round.votes[participant.id] }));
  return { id: round.id, number: round.number, revealed, votes };
}

export function toPublicView(state) {
  return {
    room: {
      code: state.code,
      name: state.name,
      status: state.status,
      facilitatorId: state.facilitatorId,
      currentStoryId: state.currentStoryId,
    },
    participants: state.participants.map((participant) => ({
      id: participant.id,
      displayName: participant.displayName,
      role: participant.role,
      connected: participant.connected,
      hasVoted: hasVoted(state.round, participant.id),
    })),
    stories: state.stories.map((story) => ({
      id: story.id,
      title: story.title,
      position: story.position,
      status: story.status,
      finalEstimate: story.finalEstimate,
    })),
    round: publicRound(state),
  };
}

// Sent to one socket only. Adds the viewer's own vote so a reconnecting voter gets it back.
export function toViewerView(state, viewerId) {
  const viewer = state.participants.find((participant) => participant.id === viewerId);
  const myVote = hasVoted(state.round, viewerId) ? state.round.votes[viewerId] : null;
  return {
    ...toPublicView(state),
    me: {
      participantId: viewerId,
      role: viewer?.role ?? null,
      isFacilitator: state.facilitatorId === viewerId,
      myVote,
    },
  };
}
