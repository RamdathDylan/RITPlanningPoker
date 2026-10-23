import express from "express";
import { createErrorHandler, notFound } from "./middleware/errors.js";

export function createApp({ logger, apiRouters = [] }) {
  const app = express();

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
