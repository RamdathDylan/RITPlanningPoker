import { randomUUID } from "node:crypto";
import express from "express";
import { errorFor } from "../../../shared/errors.js";
import { parseJoinCode } from "../../../shared/join-code.js";
import { CREATE_ROOM_BODY, JOIN_ROOM_BODY } from "../../../shared/requests.js";
import { generateRejoinToken, hashToken, isWellFormedToken } from "../auth/tokens.js";
import { findParticipantByTokenHash } from "../db/participants.js";
import { toCsv } from "../export/csv.js";
import { countLiveRooms, findRoomByCode, insertRoomWithFacilitator } from "../db/rooms.js";
import { createRateLimiter } from "../middleware/rate-limit.js";
import { validateBody } from "../middleware/validate.js";
import { generateJoinCode } from "../rooms/code.js";
import { isFacilitator } from "../rooms/state.js";

const MAX_CODE_ATTEMPTS = 3;
const UNIQUE_VIOLATION = "23505";

const isJoinCodeCollision = (error) =>
  error.code === UNIQUE_VIOLATION && error.constraint === "rooms_join_code_key";

// A collision is very unlikely (31^8 codes), but possible, so try a few fresh codes.
async function insertWithUnusedCode(pool, generateCode, room) {
  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateCode();
    try {
      await insertRoomWithFacilitator(pool, { ...room, code });
      return code;
    } catch (error) {
      if (!isJoinCodeCollision(error)) {
        throw error;
      }
    }
  }
  throw new Error(`No unused join code after ${MAX_CODE_ATTEMPTS} attempts`);
}

// Unknown, malformed, and ended rooms all look the same, so codes can't be probed (T-06).
const JOIN_FAILURES = {
  NOT_FOUND: 404,
  INVALID_STATE: 404,
  NAME_TAKEN: 409,
  ROOM_FULL: 409,
};

function sendError(response, status, code) {
  const error = errorFor(code);
  response.status(status).json({ code: error.code, error: error.message });
}

export function createRoomsRouter({
  pool,
  roomService,
  config,
  now = Date.now,
  generateCode = generateJoinCode,
}) {
  const router = express.Router();
  const { rateLimits } = config;
  const createLimiter = createRateLimiter({
    windowMs: 10 * 60_000,
    limit: rateLimits.roomCreatesPer10Minutes,
  });
  const joinLimiter = createRateLimiter({ windowMs: 60_000, limit: rateLimits.joinsPerMinute });
  const exportLimiter = createRateLimiter({ windowMs: 60_000, limit: rateLimits.exportsPerMinute });

  router.post(
    "/rooms",
    createLimiter,
    validateBody(CREATE_ROOM_BODY),
    async (_request, response) => {
      if ((await countLiveRooms(pool)) >= config.maxLiveRooms) {
        sendError(response, 503, "CAPACITY");
        return;
      }
      const { roomName, displayName } = response.locals.body;
      const rejoinToken = generateRejoinToken();
      const facilitator = { id: randomUUID(), displayName, tokenHash: hashToken(rejoinToken) };

      const code = await insertWithUnusedCode(pool, generateCode, {
        roomId: randomUUID(),
        name: roomName,
        facilitator,
        now: now(),
      });

      // The token is returned once and never logged; only its hash is stored.
      response.status(201).json({ code, participantId: facilitator.id, rejoinToken });
    },
  );

  router.post(
    "/rooms/:code/participants",
    joinLimiter,
    validateBody(JOIN_ROOM_BODY),
    async (request, response) => {
      const code = parseJoinCode(request.params.code);
      const room = code ? await findRoomByCode(pool, code) : null;
      if (!room) {
        sendError(response, 404, "NOT_FOUND");
        return;
      }

      const { displayName, role } = response.locals.body;
      const rejoinToken = generateRejoinToken();
      const participant = {
        id: randomUUID(),
        displayName,
        role,
        tokenHash: hashToken(rejoinToken),
      };

      // Joining goes through the state machine, so seat, name, and ended-room rules live in one place.
      const result = await roomService.dispatch(room.id, {
        type: "participantJoined",
        participant,
      });
      if (result.ok) {
        response.status(201).json({ participantId: participant.id, rejoinToken });
      } else if (Object.hasOwn(JOIN_FAILURES, result.code)) {
        const status = JOIN_FAILURES[result.code];
        sendError(response, status, status === 404 ? "NOT_FOUND" : result.code);
      } else {
        throw result.cause ?? new Error(`Join failed: ${result.code}`);
      }
    },
  );

  // The token must come in the Authorization header; tokens never go in URLs (T-05).
  router.get("/rooms/:code/export.csv", exportLimiter, async (request, response) => {
    const token = /^Bearer (\S+)$/.exec(request.get("Authorization") ?? "")?.[1];
    if (!isWellFormedToken(token)) {
      sendError(response, 401, "UNAUTHORIZED");
      return;
    }
    const code = parseJoinCode(request.params.code);
    const room = code ? await findRoomByCode(pool, code) : null;
    const participant = await findParticipantByTokenHash(pool, hashToken(token));
    if (!room || !participant || participant.roomId !== room.id) {
      sendError(response, 404, "NOT_FOUND");
      return;
    }
    const state = await roomService.getRoom(room.id);
    if (!isFacilitator(state, participant.id)) {
      sendError(response, 403, "FORBIDDEN");
      return;
    }

    const stories = [...state.stories].sort((a, b) => a.position - b.position);
    const csv = toCsv([
      ["Story", "Final estimate"],
      ...stories.map((story) => [story.title, story.finalEstimate]),
    ]);
    response
      .status(200)
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="planning-poker-${room.code}.csv"`,
        "Cache-Control": "no-store",
      })
      .send(csv);
  });

  return router;
}
