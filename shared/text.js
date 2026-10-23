// Characters that are invisible or reorder text. They let someone make "Alex" and "Alex"
// look identical while being different strings, or flip how a name displays (threat model T-11).
const CONTROL = "\\p{Cc}";
const BIDI_CONTROLS = "\\u061C\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069";
const INVISIBLE = "\\u200B\\u200C\\u2060\\uFEFF";
const FORBIDDEN = new RegExp(`[${CONTROL}${BIDI_CONTROLS}${INVISIBLE}]`, "u");

// The zero-width joiner (U+200D) glues emoji together, e.g. 👩 + 💻 = 👩‍💻.
// It is allowed only between two emoji, where it has a visible effect.
const EMOJI = "\\p{Extended_Pictographic}\\uFE0F?";
const JOINER_BETWEEN_EMOJI = new RegExp(`(?<=${EMOJI})\\u200D(?=\\p{Extended_Pictographic})`, "gu");

export function normalizeText(text) {
  return text.normalize("NFC").trim().replace(/\s+/g, " ");
}

export function containsForbiddenCharacters(text) {
  if (FORBIDDEN.test(text)) {
    return true;
  }
  return text.replace(JOINER_BETWEEN_EMOJI, "").includes("‍");
}

// Counts Unicode code points, matching Postgres char_length, so limits agree with the database.
export function textLength(text) {
  return [...text].length;
}
