import { randomUUID } from "node:crypto";
import { CLIENT_EVENTS } from "../../../shared/events.js";

// Turns a validated client payload into a state-machine action. The actor always comes from
// the authenticated socket, and any new ids are made here on the server, never by clients.
export const ROOM_EVENT_ACTIONS = {
  [CLIENT_EVENTS.STORY_ADD]: (actorId, { titles }) => ({
    type: "storiesAdded",
    actorId,
    stories: titles.map((title) => ({ id: randomUUID(), title })),
  }),
  [CLIENT_EVENTS.STORY_SELECT]: (actorId, { storyId }) => ({
    type: "storySelected",
    actorId,
    storyId,
    roundId: randomUUID(),
  }),
};
