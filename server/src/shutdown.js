// Graceful shutdown (CLAUDE.md deployment rules). Every accepted action is already saved
// before it is acknowledged (ADR-002), so "persist room state" means finishing the events
// still in each room's queue. Clients are then disconnected and reconnect to the new server.
export async function shutdown({ server, roomService, pool, logger, retention }) {
  logger.info("Shutting down");
  server.stopAccepting();
  retention?.stop();
  await roomService.idle();
  // Handlers send their acknowledgements just after their queued event finishes; give them
  // one turn of the event loop so clients hear "ok" before their sockets close.
  await new Promise((resolve) => setImmediate(resolve));
  await server.close();
  await pool.end();
  logger.info("Shutdown complete");
}
