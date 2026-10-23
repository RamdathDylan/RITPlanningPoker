// Every error a client can see. Messages are constants: they never include input, ids,
// or vote values, so an error can't leak anything (threat model T-03).
export const ERROR_CODES = Object.freeze({
  INVALID_PAYLOAD: "INVALID_PAYLOAD",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_STATE: "INVALID_STATE",
  NOT_FOUND: "NOT_FOUND",
  ROOM_FULL: "ROOM_FULL",
  NAME_TAKEN: "NAME_TAKEN",
  STORY_LIMIT: "STORY_LIMIT",
  STALE_ROUND: "STALE_ROUND",
  NO_VOTE: "NO_VOTE",
  NO_VOTES: "NO_VOTES",
  INVALID_TARGET: "INVALID_TARGET",
  RATE_LIMITED: "RATE_LIMITED",
  CAPACITY: "CAPACITY",
  INTERNAL: "INTERNAL",
});

export const ERROR_MESSAGES = Object.freeze({
  INVALID_PAYLOAD: "That request wasn't valid.",
  UNAUTHORIZED: "Please rejoin the room.",
  FORBIDDEN: "You don't have permission to do that.",
  INVALID_STATE: "That isn't possible right now.",
  NOT_FOUND: "Room not found.",
  ROOM_FULL: "This room is full.",
  NAME_TAKEN: "Someone in this room already uses that name.",
  STORY_LIMIT: "This room has reached its story limit.",
  STALE_ROUND: "That round has already changed.",
  NO_VOTE: "You haven't voted yet.",
  NO_VOTES: "Nobody has voted yet.",
  INVALID_TARGET: "You can't do that to that participant.",
  RATE_LIMITED: "Too many requests. Please slow down.",
  CAPACITY: "The server is busy. Please try again later.",
  INTERNAL: "Something went wrong",
});

export function errorFor(code) {
  const known = Object.hasOwn(ERROR_CODES, code ?? "") ? code : ERROR_CODES.INTERNAL;
  return { code: known, message: ERROR_MESSAGES[known] };
}
