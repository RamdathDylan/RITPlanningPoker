import path from "node:path";
import express from "express";
import { createErrorHandler, notFound } from "./middleware/errors.js";
import { applySecurityMiddleware } from "./middleware/security.js";

const ONE_YEAR_MS = 365 * 24 * 60 * 60_000;

// Serves the built React app. Hashed files in /assets never change, so browsers may cache
// them for a year; index.html is revalidated so a new deploy is picked up at once. Any other
// page-like path (no file extension) gets index.html, so links like /room/CODE load the app.
function serveClient(app, clientDist) {
  app.use(
    "/assets",
    express.static(path.join(clientDist, "assets"), { immutable: true, maxAge: ONE_YEAR_MS }),
  );
  app.use(express.static(clientDist, { index: false }));
  app.get(/^\/(?!api\/)[^.]*$/, (_request, response) => {
    response.set("Cache-Control", "no-cache").sendFile(path.join(clientDist, "index.html"));
  });
}

export function createApp({ config, logger, apiRouters = [], clientDist }) {
  const app = express();
  applySecurityMiddleware(app, config);

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  for (const router of apiRouters) {
    app.use("/api", router);
  }

  if (clientDist) {
    serveClient(app, clientDist);
  }

  app.use(notFound);
  app.use(createErrorHandler(logger));
  return app;
}
