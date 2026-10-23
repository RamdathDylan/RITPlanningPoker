import { CLIENT_EVENTS, SERVER_EVENTS } from "../../../shared/events.js";
import { reject } from "../rooms/results.js";
import { toViewerView } from "../rooms/projections.js";
import { createSocketLimiter } from "./rate-limit.js";
import { ROOM_EVENT_ACTIONS } from "./room-events.js";
import { onClientEvent } from "./wrap.js";

async function hasOtherSocket(io, roomId, participantId) {
  const sockets = await io.in(roomId).fetchSockets();
  return sockets.some((other) => other.data.participantId === participantId);
}

export function registerConnectionHandlers({ io, roomService, logger }) {
  io.on("connection", (socket) => {
    const { participantId, roomId } = socket.data;
    const options = { logger, limiter: createSocketLimiter() };

    onClientEvent(
      socket,
      CLIENT_EVENTS.ROOM_JOIN,
      async ({ code }) => {
        const room = await roomService.getRoom(roomId);
        if (!room || room.code !== code) {
          return reject("FORBIDDEN");
        }
        const result = await roomService.dispatch(roomId, {
          type: "participantConnected",
          participantId,
        });
        if (!result.ok) {
          return result;
        }
        socket.join(roomId);
        socket.data.joined = true;
        socket.emit(SERVER_EVENTS.ROOM_STATE, toViewerView(result.state, participantId));
        return result;
      },
      options,
    );

    // Every other room event: only after room:join, and always as this socket's participant.
    for (const [event, toAction] of Object.entries(ROOM_EVENT_ACTIONS)) {
      onClientEvent(
        socket,
        event,
        async (payload) => {
          if (!socket.data.joined) {
            return reject("FORBIDDEN");
          }
          return roomService.dispatch(roomId, toAction(participantId, payload));
        },
        options,
      );
    }

    onClientEvent(
      socket,
      CLIENT_EVENTS.ROOM_DELETE,
      async ({ code }) => {
        if (!socket.data.joined) {
          return reject("FORBIDDEN");
        }
        return roomService.deleteRoom(roomId, { actorId: participantId, code });
      },
      options,
    );

    // Several tabs share one seat, so the participant is only "disconnected" when the last
    // of their sockets in this room closes. By now this socket has already left the room.
    socket.on("disconnect", async () => {
      if (!socket.data.joined) {
        return;
      }
      try {
        if (!(await hasOtherSocket(io, roomId, participantId))) {
          await roomService.dispatch(roomId, { type: "participantDisconnected", participantId });
        }
      } catch (error) {
        logger.error("Disconnect handling failed", { error });
      }
    });
  });
}
