import { errorFor } from "../../../shared/errors.js";
import { validateClientEvent } from "../../../shared/events.js";

export const failure = (code) => ({ ok: false, error: errorFor(code) });

// Every client event goes through here: check the socket's rate limit, validate the payload
// against the shared schema, run the handler, and always answer through the acknowledgement.
// Errors are logged with the event name only, never the payload.
export function onClientEvent(socket, event, handler, { logger, limiter }) {
  socket.on(event, async (payload, ack) => {
    const respond = typeof ack === "function" ? ack : () => {};
    const allowance = limiter.take();
    if (allowance !== "allowed") {
      respond(failure("RATE_LIMITED"));
      if (allowance === "disconnect") {
        logger.info("Disconnected a flooding socket", { participantId: socket.data.participantId });
        socket.disconnect(true);
      }
      return;
    }
    const validated = validateClientEvent(event, payload);
    if (!validated.ok) {
      respond(failure("INVALID_PAYLOAD"));
      return;
    }
    try {
      const outcome = await handler(validated.value);
      if (!outcome.ok && outcome.cause) {
        logger.error("Socket event failed", { event, error: outcome.cause });
      }
      respond(outcome.ok ? { ok: true } : failure(outcome.code));
    } catch (error) {
      logger.error("Socket event failed", { event, error });
      respond(failure("INTERNAL"));
    }
  });
}
