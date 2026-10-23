import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { createRoomsRouter } from "./routes/rooms.js";
import { createSocketAuth } from "./sockets/auth.js";

// Large enough for 50 story titles of 200 characters; anything bigger is dropped by the
// transport before our code runs (threat model T-22).
const MAX_SOCKET_PACKET_BYTES = 64 * 1024;

export function createServer({ config, logger, pool, roomService }) {
  const apiRouters = [createRoomsRouter({ pool, roomService, config })];
  const httpServer = http.createServer(createApp({ config, logger, apiRouters }));
  const io = new Server(httpServer, {
    maxHttpBufferSize: MAX_SOCKET_PACKET_BYTES,
    cors: { origin: config.clientOrigin },
  });
  io.use(createSocketAuth({ pool, logger }));

  return {
    io,
    listen: (port) =>
      new Promise((resolve) => httpServer.listen(port, () => resolve(httpServer.address().port))),
    close: () => new Promise((resolve) => io.close(() => resolve())),
  };
}
