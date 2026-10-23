// 31 symbols: digits and capital letters without 0/O, 1/I/L, which are easy to misread
// on a projector. Eight symbols give 31^8 (about 8.5e11) possible codes (threat model T-06).
export const JOIN_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const JOIN_CODE_LENGTH = 8;

const CANONICAL_CODE = new RegExp(`^[${JOIN_CODE_ALPHABET}]{${JOIN_CODE_LENGTH}}$`);

// Accepts what people type: any case, with or without the dash or spaces.
export function parseJoinCode(input) {
  if (typeof input !== "string") {
    return null;
  }
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  return CANONICAL_CODE.test(code) ? code : null;
}

export function formatJoinCode(code) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function joinCode() {
  return (value) => {
    const code = parseJoinCode(value);
    return code
      ? { ok: true, value: code }
      : { ok: false, path: "", reason: "must be a room code" };
  };
}
