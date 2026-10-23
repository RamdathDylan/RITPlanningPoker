import { LIMITS } from "../../../shared/events.js";
import { hashToken, isWellFormedToken } from "../auth/tokens.js";
import { findParticipantByTokenHash } from "../db/participants.js";

const refusal = (message, code) => Object.assign(new Error(message), { data: { code } });

// Socket.IO middleware: runs once per connection attempt, before the connection is accepted.
// Identity comes only from the rejoin token, never from anything else the client sends (T-17).
export function createSocketAuth({ pool, logger }) {
  const openSockets = new Map();

  function release(participantId) {
    const remaining = (openSockets.get(participantId) ?? 1) - 1;
    if (remaining > 0) {
      openSockets.set(participantId, remaining);
    } else {
      openSockets.delete(participantId);
    }
  }

  return async function authenticate(socket, next) {
    const token = socket.handshake.auth?.token;
    if (!isWellFormedToken(token)) {
      next(refusal("Unauthorized", "UNAUTHORIZED"));
      return;
    }

    let participant;
    try {
      participant = await findParticipantByTokenHash(pool, hashToken(token));
    } catch (error) {
      logger.error("Socket authentication failed", { error });
      next(refusal("Unavailable", "INTERNAL"));
      return;
    }
    if (!participant) {
      next(refusal("Unauthorized", "UNAUTHORIZED"));
      return;
    }

    const open = openSockets.get(participant.id) ?? 0;
    if (open >= LIMITS.socketsPerParticipant) {
      next(refusal("Too many connections", "RATE_LIMITED"));
      return;
    }
    openSockets.set(participant.id, open + 1);
    socket.on("disconnect", () => release(participant.id));

    socket.data.participantId = participant.id;
    socket.data.roomId = participant.roomId;
    next();
  };
}
