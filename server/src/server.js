import http from "node:http";
import { createApp } from "./app.js";

export function createServer({ config, logger, apiRouters }) {
  const httpServer = http.createServer(createApp({ config, logger, apiRouters }));
  return {
    listen: (port) =>
      new Promise((resolve) => httpServer.listen(port, () => resolve(httpServer.address().port))),
    close: () => new Promise((resolve) => httpServer.close(resolve)),
  };
}
