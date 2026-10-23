import { describe, expect, it } from "vitest";
import { createSocketLimiter } from "./rate-limit.js";

function limiterAt(start = 0) {
  let now = start;
  const limiter = createSocketLimiter({ capacity: 20, refillWindowMs: 10_000, now: () => now });
  return { limiter, advance: (ms) => (now += ms) };
}

const take = (limiter, times) => Array.from({ length: times }, () => limiter.take());

describe("createSocketLimiter", () => {
  it("allows a burst of 20 events, then refuses", () => {
    const { limiter } = limiterAt();
    expect(take(limiter, 21)).toEqual([...Array(20).fill("allowed"), "limited"]);
  });

  it("refills gradually: 20 events per 10 seconds", () => {
    const { limiter, advance } = limiterAt();
    take(limiter, 20);

    advance(500);
    expect(take(limiter, 2)).toEqual(["allowed", "limited"]);

    advance(10_000);
    expect(take(limiter, 21).filter((outcome) => outcome === "allowed")).toHaveLength(20);
  });

  it("asks for a disconnect on the third refusal within a minute", () => {
    const { limiter } = limiterAt();
    take(limiter, 20);
    expect(take(limiter, 3)).toEqual(["limited", "limited", "disconnect"]);
  });

  it("forgets refusals older than a minute", () => {
    const { limiter, advance } = limiterAt();
    take(limiter, 20);
    take(limiter, 2);

    advance(61_000);
    take(limiter, 20);
    expect(limiter.take()).toBe("limited");
  });
});
