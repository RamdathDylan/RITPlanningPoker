// A clock the test moves by hand. Injected into RoomService instead of faking global timers,
// which would also freeze the database driver's own timers.
export function createFakeClock(start) {
  let current = start;
  let nextId = 1;
  const timers = new Map();

  return {
    now: () => current,
    setTimeout(callback, delayMs) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { callback, dueAt: current + delayMs });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    pendingTimers: () => timers.size,
    advance(ms) {
      current += ms;
      for (const [id, timer] of [...timers].sort((a, b) => a[1].dueAt - b[1].dueAt)) {
        if (timer.dueAt <= current) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
  };
}
