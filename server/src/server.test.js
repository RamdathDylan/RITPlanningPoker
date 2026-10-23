import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTestServer, waitFor } from "../test/helpers/socket-harness.js";

describe("socket server", () => {
  let server;

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it("serves HTTP routes and sockets from the same port", async () => {
    const response = await request(server.url).get("/health");

    expect(response.status).toBe(200);
  });

  it("refuses a socket connection without a token, with a generic error", async () => {
    const socket = server.connectClient();

    const error = await waitFor(socket, "connect_error");

    expect(error.message).toBe("Unauthorized");
    expect(socket.connected).toBe(false);
  });

  it("drops a connection whose packet is larger than 64 KB and keeps serving", async () => {
    const oversized = server.connectClient({ auth: { token: "a".repeat(100 * 1024) } });

    const error = await waitFor(oversized, "connect_error");
    expect(error.message).not.toBe("Unauthorized");
    expect(oversized.connected).toBe(false);

    expect((await request(server.url).get("/health")).status).toBe(200);
    const normal = server.connectClient({ auth: { token: "small" } });
    expect((await waitFor(normal, "connect_error")).message).toBe("Unauthorized");
  });
});
