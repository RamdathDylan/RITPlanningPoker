// The socket contract shared by client and server (CLAUDE.md: never invent an event name inline).
// Payload shapes, validation, and authorization per event: docs/architecture.md section 5.

export const CLIENT_EVENTS = Object.freeze({
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  STORY_ADD: "story:add",
  STORY_SELECT: "story:select",
  VOTE_CAST: "vote:cast",
  VOTE_CLEAR: "vote:clear",
  ROUND_REVEAL: "round:reveal",
  ROUND_REVOTE: "round:revote",
  ESTIMATE_ACCEPT: "estimate:accept",
  PARTICIPANT_REMOVE: "participant:remove",
  PARTICIPANT_SET_ROLE: "participant:setRole",
  FACILITATOR_TRANSFER: "facilitator:transfer",
  ROOM_END: "room:end",
  ROOM_DELETE: "room:delete",
});

export const SERVER_EVENTS = Object.freeze({
  ROOM_STATE: "room:state",
  PARTICIPANT_UPDATE: "participant:update",
  VOTE_STATUS: "vote:status",
  ROUND_REVEALED: "round:revealed",
  STORY_UPDATE: "story:update",
  ROOM_ENDED: "room:ended",
  ROOM_REMOVED: "room:removed",
  ERROR: "error",
});

export const LIMITS = Object.freeze({
  displayNameMax: 40,
  roomNameMax: 60,
  storyTitleMax: 200,
  participantsPerRoom: 50,
  storiesPerRoom: 200,
  storiesPerAdd: 50,
  socketsPerParticipant: 10,
});

export const NUMERIC_CARDS = Object.freeze(["0", "1", "2", "3", "5", "8", "13", "21"]);
export const FIBONACCI_DECK = Object.freeze([...NUMERIC_CARDS, "?", "☕"]);

export const ROLES = Object.freeze(["voter", "observer"]);
export const ROOM_STATUSES = Object.freeze(["idle", "voting", "revealed", "ended"]);

export const CLIENT_EVENT_SCHEMAS = Object.freeze({});

export function validateClientEvent(_event, payload) {
  return { ok: true, value: payload };
}
