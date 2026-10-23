export function createKeyedQueue() {
  return { run: (_key, task) => task(), size: () => 0, drain: async () => {} };
}
