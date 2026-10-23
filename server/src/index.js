import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { createRetentionJob } from "./jobs/retention.js";
import { createLogger } from "./logger.js";
import { createRoomService } from "./rooms/service.js";
import { createServer } from "./server.js";

const logger = createLogger();

try {
  const config = loadConfig();
  const pool = createPool(config);
  const roomService = createRoomService({ pool, handoffMs: config.handoffMs, logger });
  const server = createServer({ config, logger, pool, roomService });
  const port = await server.listen(config.port);
  await createRetentionJob({ pool, roomService, logger }).start();
  logger.info("Server listening", { port, nodeEnv: config.nodeEnv });
} catch (error) {
  logger.error("Server failed to start", { error });
  process.exitCode = 1;
}
