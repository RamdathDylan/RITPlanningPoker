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

// Tells sockets why they are being removed from the room, then closes them.
async function removeSockets(io, roomId, reason, shouldRemove) {
  const sockets = await io.in(roomId).fetchSockets();
  for (const socket of sockets.filter(shouldRemove)) {
    socket.emit(SERVER_EVENTS.ROOM_REMOVED, { reason });
    socket.disconnect(true);
  }
}

function emitViewUpdates(io, roomId, action, view) {
  if (action.type === "roomEnded") {
    io.to(roomId).emit(SERVER_EVENTS.ROOM_ENDED, {});
  }
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
}

// Turns each committed room change into socket broadcasts. Everything sent is built by
// toPublicView, the only serializer allowed to reach clients (CLAUDE.md rules 1 and 15).
export function createBroadcaster({ io, roomService, logger }) {
  const remove = (roomId, reason, shouldRemove) =>
    removeSockets(io, roomId, reason, shouldRemove).catch((error) =>
      logger.error("Could not remove sockets from a room", { error }),
    );

  roomService.onChange((roomId, { action, state, effects }) => {
    if (action.type === "roomDeleted") {
      // Next tick, so the facilitator's acknowledgement is sent before their socket closes.
      setImmediate(() => remove(roomId, "deleted", () => true));
      return;
    }
    for (const effect of effects) {
      if (effect.type === "disconnectParticipant") {
        remove(
          roomId,
          effect.reason,
          (socket) => socket.data.participantId === effect.participantId,
        );
      }
    }
    emitViewUpdates(io, roomId, action, toPublicView(state));
  });
}
