import { systemClock } from "../clock.js";
import { loadRoomState } from "../db/hydrate.js";
import { deleteRoom as deleteRoomRows } from "../db/rooms.js";
import { persist } from "../db/persist.js";
import { withTransaction } from "../db/transaction.js";
import { createKeyedQueue } from "./queue.js";
import { reduce } from "./reduce.js";
import { reject } from "./results.js";
import { isFacilitator } from "./state.js";

const UNLOAD_AFTER_MS = 10 * 60_000;

const silentLogger = { error() {} };

const anyoneConnected = (state) => state.participants.some((participant) => participant.connected);

// Owns live rooms in memory. Every change goes: queue -> reduce -> persist -> commit -> notify
// (ADR-002, ADR-009). Memory changes only after the database write succeeds.
export function createRoomService({
  pool,
  handoffMs,
  clock = systemClock,
  logger = silentLogger,
  loadRoom = loadRoomState,
  persistChange = persist,
}) {
  const rooms = new Map();
  const queue = createKeyedQueue();
  const listeners = new Set();
  const timers = new Map();

  function setTimer(roomId, kind, delayMs, callback) {
    clearTimer(roomId, kind);
    const key = `${roomId}:${kind}`;
    timers.set(
      key,
      clock.setTimeout(() => {
        timers.delete(key);
        callback();
      }, delayMs),
    );
  }

  function clearTimer(roomId, kind) {
    const key = `${roomId}:${kind}`;
    if (timers.has(key)) {
      clock.clearTimeout(timers.get(key));
      timers.delete(key);
    }
  }

  async function runSafely(description, work) {
    try {
      await work();
    } catch (error) {
      logger.error(description, { error });
    }
  }

  function unloadIfEmpty(roomId) {
    return queue.run(roomId, async () => {
      const state = rooms.get(roomId);
      if (state && !anyoneConnected(state)) {
        rooms.delete(roomId);
        clearTimer(roomId, "handoff");
      }
    });
  }

  function updateUnloadTimer(roomId, state) {
    if (anyoneConnected(state)) {
      clearTimer(roomId, "unload");
    } else if (!timers.has(`${roomId}:unload`)) {
      setTimer(roomId, "unload", UNLOAD_AFTER_MS, () =>
        runSafely("Room unload failed", () => unloadIfEmpty(roomId)),
      );
    }
  }

  function applyTimerEffects(roomId, effects) {
    for (const effect of effects) {
      if (effect.type === "scheduleHandoff") {
        setTimer(roomId, "handoff", handoffMs, () =>
          runSafely("Facilitator handoff failed", () =>
            dispatch(roomId, { type: "facilitatorHandoff", delayMs: handoffMs }),
          ),
        );
      } else if (effect.type === "cancelHandoff") {
        clearTimer(roomId, "handoff");
      }
    }
  }

  async function load(roomId) {
    if (rooms.has(roomId)) {
      return rooms.get(roomId);
    }
    const loaded = await loadRoom(pool, roomId);
    if (!loaded) {
      return null;
    }
    // After a restart nobody is connected yet. Treat everyone as disconnected since now, so a
    // facilitator who never comes back is still handed off after the usual delay.
    const now = clock.now();
    const state = {
      ...loaded,
      participants: loaded.participants.map((participant) => ({
        ...participant,
        disconnectedAt: now,
      })),
    };
    rooms.set(roomId, state);
    updateUnloadTimer(roomId, state);
    if (state.status !== "ended" && state.facilitatorId) {
      applyTimerEffects(roomId, [{ type: "scheduleHandoff" }]);
    }
    return state;
  }

  async function apply(roomId, action) {
    const previous = await load(roomId);
    if (!previous) {
      return reject("NOT_FOUND");
    }
    const now = clock.now();
    const result = reduce(previous, action, now);
    if (!result.ok) {
      return result;
    }
    try {
      await withTransaction(pool, (client) =>
        persistChange(client, { previous, next: result.state, action, now }),
      );
    } catch (error) {
      return { ok: false, code: "INTERNAL", cause: error };
    }
    rooms.set(roomId, result.state);
    applyTimerEffects(roomId, result.effects);
    updateUnloadTimer(roomId, result.state);
    const change = { action, state: result.state, effects: result.effects };
    listeners.forEach((listener) => listener(roomId, change));
    return { ok: true, state: result.state, effects: result.effects };
  }

  function dispatch(roomId, action) {
    return queue.run(roomId, () => apply(roomId, action));
  }

  // Permanent, so it needs the facilitator and the room code typed again as confirmation.
  function deleteRoom(roomId, { actorId, code }) {
    return queue.run(roomId, async () => {
      const state = await load(roomId);
      if (!state) {
        return reject("NOT_FOUND");
      }
      if (!isFacilitator(state, actorId)) {
        return reject("FORBIDDEN");
      }
      if (state.code !== code) {
        return reject("INVALID_PAYLOAD");
      }
      await deleteRoomRows(pool, roomId);
      forgetRoom(roomId, actorId);
      return { ok: true };
    });
  }

  // Drops a room that is already gone from the database and tells listeners, so any
  // connected sockets are removed too (used by the retention job).
  function evictRoom(roomId) {
    return queue.run(roomId, async () => {
      if (rooms.has(roomId)) {
        forgetRoom(roomId, null);
      }
    });
  }

  function forgetRoom(roomId, actorId) {
    rooms.delete(roomId);
    clearTimer(roomId, "handoff");
    clearTimer(roomId, "unload");
    const change = { action: { type: "roomDeleted", actorId }, state: null, effects: [] };
    listeners.forEach((listener) => listener(roomId, change));
  }

  return {
    getRoom: (roomId) => queue.run(roomId, () => load(roomId)),
    dispatch,
    deleteRoom,
    evictRoom,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // Resolves when every queued room event has finished (tests and graceful shutdown).
    idle: () => queue.drain(),
  };
}
