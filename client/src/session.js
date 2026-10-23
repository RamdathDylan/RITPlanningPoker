import { parseJoinCode } from "../../shared/join-code.js";

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;
const keyFor = (code) => `pp:room:${code}`;

function isSeat(value) {
  return (
    typeof value?.participantId === "string" &&
    typeof value?.token === "string" &&
    TOKEN_FORMAT.test(value.token)
  );
}

function defaultStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Remembers which seat this browser holds in each room, so a refresh rejoins the same seat.
// Storage can be missing or throw (private browsing, blocked site data), so every access is
// guarded and the app keeps working, just without remembering.
export function createSessionStore({ storage = defaultStorage() } = {}) {
  return {
    save(code, seat) {
      const canonical = parseJoinCode(code);
      if (!canonical || !storage) {
        return false;
      }
      try {
        storage.setItem(keyFor(canonical), JSON.stringify(seat));
        return true;
      } catch {
        return false;
      }
    },
    load(code) {
      const canonical = parseJoinCode(code);
      if (!canonical || !storage) {
        return null;
      }
      try {
        const seat = JSON.parse(storage.getItem(keyFor(canonical)));
        return isSeat(seat) ? { participantId: seat.participantId, token: seat.token } : null;
      } catch {
        return null;
      }
    },
    forget(code) {
      const canonical = parseJoinCode(code);
      if (!canonical || !storage) {
        return;
      }
      try {
        storage.removeItem(keyFor(canonical));
      } catch {
        // Nothing to do: if storage is blocked, nothing was saved either.
      }
    },
  };
}
