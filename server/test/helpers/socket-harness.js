import { io as connectSocket } from "socket.io-client";
import { createServer } from "../../src/server.js";
import { testConfig } from "./config.js";
import { createFakeLogger } from "./fake-logger.js";

// Starts the real HTTP + Socket.IO server on a random free port (port 0).
export async function startTestServer({ configOverrides = {}, apiRouters = [] } = {}) {
  const logger = createFakeLogger();
  const server = createServer({ config: testConfig(configOverrides), logger, apiRouters });
  const port = await server.listen(0);
  const clients = [];

  function connectClient({ auth } = {}) {
    const socket = connectSocket(`http://localhost:${port}`, {
      auth,
      forceNew: true,
      reconnection: false,
      transports: ["websocket"],
    });
    clients.push(socket);
    return socket;
  }

  async function close() {
    for (const socket of clients) {
      socket.disconnect();
    }
    await server.close();
  }

  return { url: `http://localhost:${port}`, logger, connectClient, close };
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
