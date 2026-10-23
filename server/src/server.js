import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { createRoomsRouter } from "./routes/rooms.js";
import { createSocketAuth } from "./sockets/auth.js";
import { createBroadcaster } from "./sockets/broadcast.js";
import { registerConnectionHandlers } from "./sockets/connection.js";

// Large enough for 50 story titles of 200 characters; anything bigger is dropped by the
// transport before our code runs (threat model T-22).
const MAX_SOCKET_PACKET_BYTES = 64 * 1024;

// Heartbeat: the server pings every 10 s and treats 10 s without an answer as a drop.
// Socket.IO's defaults (25 s + 20 s) could leave a phone that lost signal looking connected
// for 45 s, and would stretch the 60 s facilitator handoff to almost two minutes.
const PING_INTERVAL_MS = 10_000;
const PING_TIMEOUT_MS = 10_000;

export function createServer({ config, logger, pool, roomService }) {
  const apiRouters = [createRoomsRouter({ pool, roomService, config })];
  const httpServer = http.createServer(
    createApp({ config, logger, apiRouters, clientDist: config.clientDist }),
  );
  const io = new Server(httpServer, {
    maxHttpBufferSize: MAX_SOCKET_PACKET_BYTES,
    pingInterval: PING_INTERVAL_MS,
    pingTimeout: PING_TIMEOUT_MS,
    cors: { origin: config.clientOrigin },
  });
  io.use(createSocketAuth({ pool, logger }));
  registerConnectionHandlers({ io, roomService, logger });
  createBroadcaster({ io, roomService, logger });

  return {
    io,
    listen: (port) =>
      new Promise((resolve) => httpServer.listen(port, () => resolve(httpServer.address().port))),
    // Refuses new connections; existing ones stay open until close().
    stopAccepting: () => httpServer.close(),
    close: () => new Promise((resolve) => io.close(() => resolve())),
  };
}
