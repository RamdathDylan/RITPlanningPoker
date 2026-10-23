// Stand-ins for the network-facing services, so page tests control every response.
export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function createFakeSessions() {
  const seats = new Map();
  return {
    seats,
    save: (code, seat) => {
      seats.set(code, seat);
      return true;
    },
    load: (code) => seats.get(code) ?? null,
    forget: (code) => seats.delete(code),
  };
}
