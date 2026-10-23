import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createServer } from "./server.js";

const logger = createLogger();

try {
  const config = loadConfig();
  const server = createServer({ config, logger });
  const port = await server.listen(config.port);
  logger.info("Server listening", { port, nodeEnv: config.nodeEnv });
} catch (error) {
  logger.error("Server failed to start", { error });
  process.exitCode = 1;
}
