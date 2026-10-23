import { SERVER_EVENTS } from "../../../shared/events.js";

// The client's copy of the room, built from a room:state snapshot and kept current by
// applying each server event. Pure: (state, { event, payload }) -> new state.

function withMe(state, participants, facilitatorId) {
  const me = participants.find((participant) => participant.id === state.me.participantId);
  return {
    ...state.me,
    role: me?.role ?? state.me.role,
    isFacilitator: facilitatorId === state.me.participantId,
  };
}

const handlers = {
  [SERVER_EVENTS.ROOM_STATE]: (_state, snapshot) => snapshot,

  [SERVER_EVENTS.PARTICIPANT_UPDATE]: (state, { participants, facilitatorId }) => ({
    ...state,
    participants,
    room: { ...state.room, facilitatorId },
    me: withMe(state, participants, facilitatorId),
  }),

  [SERVER_EVENTS.VOTE_STATUS]: (state, { roundId, votedIds }) => {
    if (state.round?.id !== roundId) {
      return state;
    }
    const voted = new Set(votedIds);
    return {
      ...state,
      participants: state.participants.map((participant) => ({
        ...participant,
        hasVoted: voted.has(participant.id),
      })),
    };
  },

  [SERVER_EVENTS.STORY_UPDATE]: (state, { stories, currentStoryId, status, round }) => {
    const newRound = round !== null && round.id !== state.round?.id;
    return {
      ...state,
      stories,
      room: { ...state.room, currentStoryId, status },
      round: round === null ? null : newRound ? { ...round, revealed: false } : state.round,
      participants:
        newRound || round === null
          ? state.participants.map((participant) => ({ ...participant, hasVoted: false }))
          : state.participants,
      me: newRound || round === null ? { ...state.me, myVote: null } : state.me,
    };
  },

  [SERVER_EVENTS.ROUND_REVEALED]: (state, { roundId, votes, stats }) => ({
    ...state,
    room: { ...state.room, status: "revealed" },
    round: { id: roundId, number: state.round?.number, revealed: true, votes, stats },
  }),

  [SERVER_EVENTS.ROOM_ENDED]: (state) => ({
    ...state,
    room: { ...state.room, status: "ended", currentStoryId: null },
    round: null,
  }),

  // Not from the server: the client records its own vote once the server has accepted it.
  "local:myVote": (state, { value }) => ({ ...state, me: { ...state.me, myVote: value } }),
};

export function roomReducer(state, { event, payload }) {
  if (!Object.hasOwn(handlers, event)) {
    return state;
  }
  if (state === null && event !== SERVER_EVENTS.ROOM_STATE) {
    return state;
  }
  return handlers[event](state, payload);
}
