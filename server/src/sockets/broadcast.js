import { SERVER_EVENTS } from "../../../shared/events.js";
import { toPublicView } from "../rooms/projections.js";

const PARTICIPANT_ACTIONS = new Set([
  "participantJoined",
  "participantConnected",
  "participantDisconnected",
  "participantLeft",
  "participantRemoved",
  "roleChanged",
  "facilitatorTransferred",
  "facilitatorHandoff",
]);

const VOTE_ACTIONS = new Set(["voteCast", "voteCleared"]);
const STORY_ACTIONS = new Set([
  "storiesAdded",
  "storySelected",
  "roundRevoted",
  "estimateAccepted",
]);

// Turns each committed room change into socket broadcasts. Everything sent is built by
// toPublicView, the only serializer allowed to reach clients (CLAUDE.md rules 1 and 15).
// Tells a removed participant why, then closes every one of their sockets in the room.
async function disconnectParticipant(io, roomId, { participantId, reason }) {
  const sockets = await io.in(roomId).fetchSockets();
  for (const socket of sockets.filter(
    (candidate) => candidate.data.participantId === participantId,
  )) {
    socket.emit(SERVER_EVENTS.ROOM_REMOVED, { reason });
    socket.disconnect(true);
  }
}

export function createBroadcaster({ io, roomService, logger }) {
  roomService.onChange((roomId, { action, state, effects }) => {
    for (const effect of effects.filter(
      (candidate) => candidate.type === "disconnectParticipant",
    )) {
      disconnectParticipant(io, roomId, effect).catch((error) =>
        logger.error("Could not disconnect a removed participant", { error }),
      );
    }
    const view = toPublicView(state);
    if (action.type === "roundRevealed") {
      const { id, votes, stats } = view.round;
      io.to(roomId).emit(SERVER_EVENTS.ROUND_REVEALED, { roundId: id, votes, stats });
    }
    if (VOTE_ACTIONS.has(action.type)) {
      // Who has voted, never what (CLAUDE.md security rule 1).
      io.to(roomId).emit(SERVER_EVENTS.VOTE_STATUS, {
        roundId: view.round.id,
        votedIds: view.participants
          .filter((participant) => participant.hasVoted)
          .map((participant) => participant.id),
      });
    }
    if (STORY_ACTIONS.has(action.type)) {
      io.to(roomId).emit(SERVER_EVENTS.STORY_UPDATE, {
        stories: view.stories,
        currentStoryId: view.room.currentStoryId,
        status: view.room.status,
        round: view.round ? { id: view.round.id, number: view.round.number } : null,
      });
    }
    if (PARTICIPANT_ACTIONS.has(action.type)) {
      io.to(roomId).emit(SERVER_EVENTS.PARTICIPANT_UPDATE, {
        participants: view.participants,
        facilitatorId: view.room.facilitatorId,
      });
    }
  });
}
