import { randomUUID } from "node:crypto";
import { io as connectSocket } from "socket.io-client";
import { generateRejoinToken, hashToken } from "../../src/auth/tokens.js";
import { insertRoomWithFacilitator } from "../../src/db/rooms.js";
import { createRoomService } from "../../src/rooms/service.js";
import { createServer } from "../../src/server.js";
import { testConfig } from "./config.js";
import { createAppPool } from "./db.js";
import { createFakeLogger } from "./fake-logger.js";

// Starts the real HTTP + Socket.IO server on a random free port (port 0), with its own
// database pool (as pp_app) and RoomService.
export async function startTestServer({ configOverrides = {} } = {}) {
  const config = testConfig(configOverrides);
  const logger = createFakeLogger();
  const pool = createAppPool();
  const roomService = createRoomService({ pool, handoffMs: config.handoffMs, logger });
  const server = createServer({ config, logger, pool, roomService });
  const port = await server.listen(0);
  const url = `http://localhost:${port}`;
  const clients = [];

  function connectClient({ auth } = {}) {
    const socket = connectSocket(url, {
      auth,
      forceNew: true,
      reconnection: false,
      transports: ["websocket"],
    });
    clients.push(socket);
    return socket;
  }

  // A room with a facilitator, created straight through the database layer.
  async function seedRoom({ code = "ABCDEFGH" } = {}) {
    const token = generateRejoinToken();
    const room = {
      roomId: randomUUID(),
      code,
      name: "Sprint 12",
      facilitator: { id: randomUUID(), displayName: "Dana", tokenHash: hashToken(token) },
      now: Date.now(),
    };
    await insertRoomWithFacilitator(pool, room);
    return {
      roomId: room.roomId,
      code,
      facilitatorId: room.facilitator.id,
      facilitatorToken: token,
    };
  }

  async function addParticipant(roomId, displayName, role = "voter") {
    const token = generateRejoinToken();
    const participant = { id: randomUUID(), displayName, role, tokenHash: hashToken(token) };
    const result = await roomService.dispatch(roomId, { type: "participantJoined", participant });
    if (!result.ok) {
      throw new Error(`Could not add participant: ${result.code}`);
    }
    return { participantId: participant.id, token };
  }

  async function close() {
    for (const socket of clients) {
      socket.disconnect();
    }
    await server.close();
    await roomService.idle();
    await pool.end();
  }

  return { url, logger, pool, roomService, server, connectClient, seedRoom, addParticipant, close };
}

export function waitFor(socket, event, { timeoutMs = 2000 } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out after ${timeoutMs} ms waiting for "${event}"`));
    }, timeoutMs);
    function onEvent(...args) {
      clearTimeout(timer);
      resolve(args.length <= 1 ? args[0] : args);
    }
    socket.once(event, onEvent);
  });
}

// Resolves with "connect" or the connect_error message, whichever happens first.
export async function connectionOutcome(socket) {
  return new Promise((resolve) => {
    socket.once("connect", () => resolve("connected"));
    socket.once("connect_error", (error) => resolve(error.message));
  });
}
