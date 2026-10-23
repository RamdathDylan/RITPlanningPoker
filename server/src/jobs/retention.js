import { systemClock } from "../clock.js";
import { deleteRoomsInactiveSince } from "../db/rooms.js";

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

// CLAUDE.md data retention: rooms and everything in them are deleted after 30 days without
// activity. Runs at start-up and then every hour. Logs a count only, never ids or names.
export function createRetentionJob({
  pool,
  roomService,
  logger,
  clock = systemClock,
  intervalMs = HOUR_MS,
  maxInactiveDays = 30,
}) {
  let timer = null;
  let stopped = false;
  let current = Promise.resolve();

  async function runOnce() {
    const cutoff = new Date(clock.now() - maxInactiveDays * DAY_MS);
    const deletedIds = await deleteRoomsInactiveSince(pool, cutoff);
    for (const roomId of deletedIds) {
      await roomService.evictRoom(roomId);
    }
    if (deletedIds.length > 0) {
      logger.info("Deleted inactive rooms", { count: deletedIds.length });
    }
  }

  async function runSafely() {
    try {
      await runOnce();
    } catch (error) {
      logger.error("Retention job failed", { error });
    }
  }

  function scheduleNext() {
    if (stopped) {
      return;
    }
    timer = clock.setTimeout(() => {
      current = (async () => {
        await runSafely();
        scheduleNext();
      })();
    }, intervalMs);
  }

  return {
    runOnce,
    async start() {
      stopped = false;
      current = runSafely();
      await current;
      scheduleNext();
    },
    stop() {
      stopped = true;
      if (timer !== null) {
        clock.clearTimeout(timer);
        timer = null;
      }
    },
    idle: () => current,
  };
}
