import { randomUUID } from "node:crypto";
import express from "express";
import { CREATE_ROOM_BODY } from "../../../shared/requests.js";
import { generateRejoinToken, hashToken } from "../auth/tokens.js";
import { insertRoomWithFacilitator } from "../db/rooms.js";
import { validateBody } from "../middleware/validate.js";
import { generateJoinCode } from "../rooms/code.js";

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

export function createRoomsRouter({ pool, now = Date.now, generateCode = generateJoinCode }) {
  const router = express.Router();

  router.post("/rooms", validateBody(CREATE_ROOM_BODY), async (_request, response) => {
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
  });

  return router;
}
