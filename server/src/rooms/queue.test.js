import { describe, expect, it } from "vitest";
import { createKeyedQueue } from "./queue.js";

// A promise the test resolves by hand, to control exactly when each task finishes.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("createKeyedQueue", () => {
  it("runs tasks for the same key one at a time, in the order they were added", async () => {
    const queue = createKeyedQueue();
    const log = [];
    const slow = deferred();

    const first = queue.run("room-1", async () => {
      log.push("A start");
      await slow.promise;
      log.push("A end");
      return "A";
    });
    const second = queue.run("room-1", async () => {
      log.push("B start");
      return "B";
    });

    await flush();
    expect(log).toEqual(["A start"]);

    slow.resolve();
    expect(await Promise.all([first, second])).toEqual(["A", "B"]);
    expect(log).toEqual(["A start", "A end", "B start"]);
  });

  it("lets a later task see what an earlier task changed", async () => {
    const queue = createKeyedQueue();
    let counter = 0;
    const read = async () => {
      const seen = counter;
      await flush();
      counter = seen + 1;
      return counter;
    };

    expect(
      await Promise.all([queue.run("r", read), queue.run("r", read), queue.run("r", read)]),
    ).toEqual([1, 2, 3]);
  });

  it("rejects only the failing task and keeps running the rest", async () => {
    const queue = createKeyedQueue();
    const failing = queue.run("room-1", async () => {
      throw new Error("write failed");
    });
    const next = queue.run("room-1", async () => "still runs");

    await expect(failing).rejects.toThrow("write failed");
    expect(await next).toBe("still runs");
  });

  it("runs different keys independently", async () => {
    const queue = createKeyedQueue();
    const blocked = deferred();
    const roomOne = queue.run("room-1", () => blocked.promise);

    expect(await queue.run("room-2", async () => "room-2 done")).toBe("room-2 done");

    blocked.resolve("room-1 done");
    expect(await roomOne).toBe("room-1 done");
  });

  it("forgets a key once its queue is empty", async () => {
    const queue = createKeyedQueue();
    await queue.run("room-1", async () => {});
    expect(queue.size()).toBe(0);
  });

  it("waits for every queue to finish when draining", async () => {
    const queue = createKeyedQueue();
    const slow = deferred();
    let finished = false;
    queue.run("room-1", async () => {
      await slow.promise;
      finished = true;
    });

    const drained = queue.drain();
    await flush();
    expect(finished).toBe(false);

    slow.resolve();
    await drained;
    expect(finished).toBe(true);
  });
});
