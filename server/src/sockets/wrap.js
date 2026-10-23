import { errorFor } from "../../../shared/errors.js";
import { validateClientEvent } from "../../../shared/events.js";

export const failure = (code) => ({ ok: false, error: errorFor(code) });

// Every client event goes through here: validate the payload against the shared schema,
// run the handler, and always answer through the acknowledgement callback.
export function onClientEvent(socket, event, handler, { logger }) {
  socket.on(event, async (payload, ack) => {
    const respond = typeof ack === "function" ? ack : () => {};
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
