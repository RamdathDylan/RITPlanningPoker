// A token bucket per socket: it holds up to `capacity` tokens, refills at `capacity` per
// `refillWindowMs`, and each event spends one. Bursts are fine; sustained flooding is not.
// Repeated refusals within a minute mean the client is misbehaving, so it is disconnected (T-21).
export function createSocketLimiter({
  capacity = 20,
  refillWindowMs = 10_000,
  maxViolations = 3,
  violationWindowMs = 60_000,
  now = Date.now,
} = {}) {
  let tokens = capacity;
  let lastRefill = now();
  let violations = [];

  return {
    take() {
      const current = now();
      tokens = Math.min(capacity, tokens + ((current - lastRefill) * capacity) / refillWindowMs);
      lastRefill = current;

      if (tokens >= 1) {
        tokens -= 1;
        return "allowed";
      }
      violations = violations.filter((at) => current - at < violationWindowMs);
      violations.push(current);
      return violations.length >= maxViolations ? "disconnect" : "limited";
    },
  };
}
