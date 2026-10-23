import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.js";

function captureStream() {
  const lines = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(...chunk.toString().split("\n").filter(Boolean));
      callback();
    },
  });
  return { stream, lines };
}

const fixedNow = () => new Date("2026-10-23T12:00:00.000Z");

describe("createLogger", () => {
  it("writes one JSON line per entry with time, level, message, and details", () => {
    const { stream, lines } = captureStream();
    createLogger({ stream, now: fixedNow }).info("Server started", { port: 3000 });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual({
      time: "2026-10-23T12:00:00.000Z",
      level: "info",
      message: "Server started",
      port: 3000,
    });
  });

  it("serializes errors with name, message, and stack", () => {
    const { stream, lines } = captureStream();
    const failure = new TypeError("boom");
    createLogger({ stream, now: fixedNow }).error("Request failed", { error: failure });

    const entry = JSON.parse(lines[0]);
    expect(entry.level).toBe("error");
    expect(entry.error).toEqual({ name: "TypeError", message: "boom", stack: failure.stack });
  });
});
