import http from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";

// Large enough for 50 story titles of 200 characters; anything bigger is dropped by the
// transport before our code runs (threat model T-22).
const MAX_SOCKET_PACKET_BYTES = 64 * 1024;

function refuseAllConnections(_socket, next) {
  // Placeholder until rejoin-token authentication (roadmap 6.1). Generic message by design.
  next(new Error("Unauthorized"));
}

export function createServer({ config, logger, apiRouters }) {
  const httpServer = http.createServer(createApp({ config, logger, apiRouters }));
  const io = new Server(httpServer, {
    maxHttpBufferSize: MAX_SOCKET_PACKET_BYTES,
    cors: { origin: config.clientOrigin },
  });
  io.use(refuseAllConnections);

  return {
    listen: (port) =>
      new Promise((resolve) => httpServer.listen(port, () => resolve(httpServer.address().port))),
    close: () => new Promise((resolve) => io.close(() => resolve())),
  };
}
