import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { CLIENT_EVENTS, SERVER_EVENTS } from "../../../shared/events.js";
import { NETWORK_MESSAGE } from "../api.js";
import { useServices } from "../services.jsx";
import { roomReducer } from "./room-state.js";

const ACK_TIMEOUT_MS = 5000;
const NO_RESPONSE = { ok: false, error: { code: "NETWORK", message: NETWORK_MESSAGE } };

// Every server event except the ones handled separately below feeds the room reducer.
const ROOM_EVENTS = Object.values(SERVER_EVENTS).filter(
  (event) => event !== SERVER_EVENTS.ROOM_REMOVED && event !== SERVER_EVENTS.ERROR,
);

// Connects to a room with this browser's stored seat and keeps the room state live.
// status: "no-seat" | "connecting" | "connected" | "reconnecting" | "failed"
//       | "unauthorized" | "removed" | "left"
export function useRoom(code) {
  const { sessions, connectSocket } = useServices();
  const [room, dispatch] = useReducer(roomReducer, null);
  const [seat] = useState(() => sessions.load(code));
  const [status, setStatus] = useState(seat ? "connecting" : "no-seat");
  const [error, setError] = useState(null);
  const [removedReason, setRemovedReason] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!seat) {
      return undefined;
    }
    const socket = connectSocket(seat.token);
    socketRef.current = socket;

    // Runs on the first connect and again after every automatic reconnect.
    socket.on("connect", async () => {
      setStatus("connecting");
      const ack = await socket
        .timeout(ACK_TIMEOUT_MS)
        .emitWithAck(CLIENT_EVENTS.ROOM_JOIN, { code });
      if (ack.ok) {
        setStatus("connected");
      } else {
        setError(ack.error);
        setStatus("failed");
      }
    });
    socket.on("connect_error", (connectError) => {
      if (connectError.message === "Unauthorized") {
        sessions.forget(code);
        setStatus("unauthorized");
        socket.disconnect();
      } else {
        setStatus("reconnecting");
      }
    });
    socket.on("disconnect", (reason) => {
      if (reason !== "io client disconnect") {
        setStatus((current) => (current === "removed" ? current : "reconnecting"));
      }
    });
    socket.on(SERVER_EVENTS.ROOM_REMOVED, ({ reason }) => {
      sessions.forget(code);
      setRemovedReason(reason);
      setStatus("removed");
    });
    for (const event of ROOM_EVENTS) {
      socket.on(event, (payload) => dispatch({ event, payload }));
    }

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [code, seat, sessions, connectSocket]);

  const send = useCallback(async (event, payload) => {
    const socket = socketRef.current;
    if (!socket) {
      return NO_RESPONSE;
    }
    let ack;
    try {
      ack = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload);
    } catch {
      return NO_RESPONSE;
    }
    if (ack.ok && event === CLIENT_EVENTS.VOTE_CAST) {
      dispatch({ event: "local:myVote", payload: { value: payload.value } });
    }
    if (ack.ok && event === CLIENT_EVENTS.VOTE_CLEAR) {
      dispatch({ event: "local:myVote", payload: { value: null } });
    }
    return ack;
  }, []);

  const leave = useCallback(async () => {
    const ack = await send(CLIENT_EVENTS.ROOM_LEAVE, {});
    if (ack.ok) {
      sessions.forget(code);
      socketRef.current?.disconnect();
      setStatus("left");
    }
    return ack;
  }, [code, send, sessions]);

  return { status, room, error, removedReason, send, leave };
}
