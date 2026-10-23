// HTTP request bodies, shared so the client's forms check the same rules the server enforces.
import { LIMITS, ROLES } from "./events.js";
import { object, oneOf, string } from "./validate.js";

const displayName = string({ min: 1, max: LIMITS.displayNameMax });

export const CREATE_ROOM_BODY = object({
  roomName: string({ min: 1, max: LIMITS.roomNameMax }),
  displayName,
});

export const JOIN_ROOM_BODY = object({ displayName, role: oneOf(ROLES) });
