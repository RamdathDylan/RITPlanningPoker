import { describe, expect, it } from "vitest";
import { computeStats } from "./stats.js";

describe("computeStats", () => {
  it("summarizes numeric votes", () => {
    expect(computeStats(["3", "5", "8"])).toEqual({
      count: 3,
      numericCount: 3,
      min: 3,
      max: 8,
      mean: 5.3,
      median: 5,
      suggestion: "5",
      consensus: false,
      unsureCount: 0,
      breakCount: 0,
      distribution: { 3: 1, 5: 1, 8: 1 },
    });
  });

  it("averages the middle two votes for an even count and rounds the suggestion up to a card", () => {
    expect(computeStats(["3", "5"])).toMatchObject({ median: 4, suggestion: "5", mean: 4 });
  });

  it("handles the widest spread", () => {
    expect(computeStats(["0", "21"])).toMatchObject({
      min: 0,
      max: 21,
      mean: 10.5,
      median: 10.5,
      suggestion: "13",
    });
  });

  it("counts unsure and break cards separately and leaves them out of the math", () => {
    expect(computeStats(["5", "5", "?", "☕"])).toMatchObject({
      count: 4,
      numericCount: 2,
      mean: 5,
      median: 5,
      consensus: true,
      unsureCount: 1,
      breakCount: 1,
      distribution: { 5: 2, "?": 1, "☕": 1 },
    });
  });

  it("reports consensus only when every numeric vote is equal", () => {
    expect(computeStats(["8", "8", "8"]).consensus).toBe(true);
    expect(computeStats(["8", "8", "13"]).consensus).toBe(false);
  });

  it("returns null numbers when nobody chose a number", () => {
    expect(computeStats(["?", "☕"])).toEqual({
      count: 2,
      numericCount: 0,
      min: null,
      max: null,
      mean: null,
      median: null,
      suggestion: null,
      consensus: false,
      unsureCount: 1,
      breakCount: 1,
      distribution: { "?": 1, "☕": 1 },
    });
  });

  it("works for a single vote", () => {
    expect(computeStats(["2"])).toMatchObject({ median: 2, suggestion: "2", consensus: true });
  });
});
