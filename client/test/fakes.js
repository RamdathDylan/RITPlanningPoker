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

// A stand-in for a socket.io-client socket. Tests play the server: they answer emits with
// `respond` and push events with `serverSends`.
export function createFakeSocket({ respond = () => ({ ok: true }) } = {}) {
  const handlers = new Map();
  const socket = {
    emitted: [],
    disconnected: false,
    respond,
    on(event, handler) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return socket;
    },
    off(event, handler) {
      handlers.set(
        event,
        (handlers.get(event) ?? []).filter((candidate) => candidate !== handler),
      );
      return socket;
    },
    timeout() {
      return socket;
    },
    async emitWithAck(event, payload) {
      socket.emitted.push({ event, payload });
      return socket.respond(event, payload);
    },
    disconnect() {
      socket.disconnected = true;
      socket.serverSends("disconnect", "io client disconnect");
    },
    serverSends(event, ...args) {
      for (const handler of handlers.get(event) ?? []) {
        handler(...args);
      }
    },
  };
  return socket;
}
