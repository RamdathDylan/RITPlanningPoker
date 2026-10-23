// Runs async tasks one at a time per key (a room id), in the order they were added.
// Node runs one thing at a time, but async handlers interleave at every `await`; without this,
// two events for the same room could both pass their checks before either saved (ADR-009).
export function createKeyedQueue() {
  const queues = new Map();
  const idleWaiters = new Set();

  async function drainKey(key, tasks) {
    while (tasks.length > 0) {
      const { task, resolve, reject } = tasks.shift();
      try {
        resolve(await task());
      } catch (error) {
        reject(error);
      }
    }
    queues.delete(key);
    if (queues.size === 0) {
      idleWaiters.forEach((wake) => wake());
      idleWaiters.clear();
    }
  }

  function run(key, task) {
    return new Promise((resolve, reject) => {
      const tasks = queues.get(key);
      if (tasks) {
        tasks.push({ task, resolve, reject });
        return;
      }
      const fresh = [{ task, resolve, reject }];
      queues.set(key, fresh);
      drainKey(key, fresh);
    });
  }

  // Resolves once every queued task has finished (used by graceful shutdown).
  function drain() {
    if (queues.size === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => idleWaiters.add(resolve));
  }

  return { run, drain, size: () => queues.size };
}
