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

const STORY_ACTIONS = new Set([
  "storiesAdded",
  "storySelected",
  "roundRevoted",
  "estimateAccepted",
]);

// Turns each committed room change into socket broadcasts. Everything sent is built by
// toPublicView, the only serializer allowed to reach clients (CLAUDE.md rules 1 and 15).
export function createBroadcaster({ io, roomService }) {
  roomService.onChange((roomId, { action, state }) => {
    const view = toPublicView(state);
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
