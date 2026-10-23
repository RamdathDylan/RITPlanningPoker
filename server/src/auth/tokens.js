import { createHash, randomBytes as cryptoRandomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
// 32 bytes in base64url is always 43 characters from A-Z a-z 0-9 - _ (no padding).
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

// 256 random bits: impossible to guess, so a fast hash is enough to store it (ADR-003).
// randomBytes is injectable for tests only; production uses node:crypto (CLAUDE.md rule 5).
export function generateRejoinToken(randomBytes = cryptoRandomBytes) {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

// Only this hash is stored, so a leaked database can't be used to take over seats.
export function hashToken(token) {
  return createHash("sha256").update(token).digest();
}

// Checked before any database lookup, so junk input never reaches a query.
export function isWellFormedToken(token) {
  return typeof token === "string" && TOKEN_FORMAT.test(token);
}
