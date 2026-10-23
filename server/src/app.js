import express from "express";
import { createErrorHandler, notFound } from "./middleware/errors.js";
import { applySecurityMiddleware } from "./middleware/security.js";

export function createApp({ config, logger, apiRouters = [] }) {
  const app = express();
  applySecurityMiddleware(app, config);

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  for (const router of apiRouters) {
    app.use("/api", router);
  }

  app.use(notFound);
  app.use(createErrorHandler(logger));
  return app;
}
