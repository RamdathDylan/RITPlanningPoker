// The real clock. Services take a clock as a dependency so tests can pass a fake one.
export const systemClock = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (id) => clearTimeout(id),
};
