import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { createRetentionJob } from "./jobs/retention.js";
import { createLogger } from "./logger.js";
import { createRoomService } from "./rooms/service.js";
import { createServer } from "./server.js";
import { shutdown } from "./shutdown.js";

// Docker waits 15 s after SIGTERM before killing the container; finish (or give up) before that.
const SHUTDOWN_DEADLINE_MS = 14_000;

const logger = createLogger();

function exitOnSignals(parts) {
  let stopping = false;
  const stop = async (signal) => {
    if (stopping) {
      return;
    }
    stopping = true;
    logger.info("Received signal", { signal });
    setTimeout(() => {
      logger.error("Shutdown took too long; exiting");
      process.exit(1);
    }, SHUTDOWN_DEADLINE_MS).unref();
    try {
      await shutdown({ ...parts, logger });
      process.exitCode = 0;
    } catch (error) {
      logger.error("Shutdown failed", { error });
      process.exitCode = 1;
    }
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

try {
  const config = loadConfig();
  const pool = createPool(config);
  const roomService = createRoomService({ pool, handoffMs: config.handoffMs, logger });
  const server = createServer({ config, logger, pool, roomService });
  const port = await server.listen(config.port);
  const retention = createRetentionJob({ pool, roomService, logger });
  await retention.start();
  exitOnSignals({ server, roomService, pool, retention });
  logger.info("Server listening", { port, nodeEnv: config.nodeEnv });
} catch (error) {
  logger.error("Server failed to start", { error });
  process.exitCode = 1;
}
