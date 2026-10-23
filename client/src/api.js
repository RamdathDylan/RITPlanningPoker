import { errorFor } from "../../shared/errors.js";
import { parseJoinCode } from "../../shared/join-code.js";

export const NETWORK_MESSAGE = "Can't reach the server. Check your connection and try again.";

// Used when a response has no usable body (e.g. a proxy error page).
const CODE_FOR_STATUS = { 404: "NOT_FOUND", 429: "RATE_LIMITED", 503: "CAPACITY" };

export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

function errorFromResponse(status, body) {
  if (typeof body?.code === "string" && typeof body?.error === "string") {
    return new ApiError(body.code, body.error);
  }
  const code = CODE_FOR_STATUS[status] ?? (status >= 500 ? "INTERNAL" : "INVALID_PAYLOAD");
  return new ApiError(code, errorFor(code).message);
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// `fetch` is injectable so tests can stand in for the network.
export function createApi({ fetch = (...args) => globalThis.fetch(...args) } = {}) {
  async function post(url, body) {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ApiError("NETWORK", NETWORK_MESSAGE);
    }
    const json = await readJson(response);
    if (!response.ok) {
      throw errorFromResponse(response.status, json);
    }
    return json;
  }

  return {
    createRoom: (body) => post("/api/rooms", body),
    async joinRoom(code, body) {
      const canonical = parseJoinCode(code);
      if (!canonical) {
        throw new ApiError("NOT_FOUND", errorFor("NOT_FOUND").message);
      }
      return post(`/api/rooms/${canonical}/participants`, body);
    },
  };
}
