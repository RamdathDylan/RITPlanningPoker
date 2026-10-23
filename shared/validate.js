import { containsForbiddenCharacters, normalizeText, textLength } from "./text.js";

// Every validator is a function: value => { ok: true, value } | { ok: false, path, reason }.
// The returned value is the cleaned version (normalized text, lowercased id, fresh object),
// so callers use it instead of the raw input.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const pass = (value) => ({ ok: true, value });
const fail = (reason, path = "") => ({ ok: false, path, reason });
const joinPath = (parent, child) =>
  child.startsWith("[") || !child ? `${parent}${child}` : `${parent}.${child}`;

export function string({ min, max }) {
  return (value) => {
    if (typeof value !== "string") {
      return fail("must be text");
    }
    const text = normalizeText(value);
    if (containsForbiddenCharacters(text)) {
      return fail("contains unsupported characters");
    }
    const length = textLength(text);
    if (length < min || length > max) {
      return fail(`must be ${min} to ${max} characters`);
    }
    return pass(text);
  };
}

export function uuid() {
  return (value) =>
    typeof value === "string" && UUID.test(value)
      ? pass(value.toLowerCase())
      : fail("must be an id");
}

export function oneOf(allowed) {
  return (value) => (allowed.includes(value) ? pass(value) : fail("is not an allowed value"));
}

export function arrayOf(itemValidator, { min, max }) {
  return (value) => {
    if (!Array.isArray(value)) {
      return fail("must be a list");
    }
    if (value.length < min || value.length > max) {
      return fail(`must have ${min} to ${max} items`);
    }
    const items = [];
    for (const [index, item] of value.entries()) {
      const result = itemValidator(item);
      if (!result.ok) {
        return fail(result.reason, joinPath(`[${index}]`, result.path));
      }
      items.push(result.value);
    }
    return pass(items);
  };
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function object(shape) {
  const allowedKeys = Object.keys(shape);
  return (value) => {
    if (!isPlainObject(value)) {
      return fail("must be an object");
    }
    // JSON.parse creates "__proto__" as an ordinary own key, so it must be checked explicitly.
    const unexpected = Object.keys(value).find(
      (key) => DANGEROUS_KEYS.has(key) || !allowedKeys.includes(key),
    );
    if (unexpected !== undefined) {
      return fail("is not allowed", unexpected);
    }
    const cleaned = {};
    for (const key of allowedKeys) {
      if (!Object.hasOwn(value, key)) {
        return fail("is required", key);
      }
      const result = shape[key](value[key]);
      if (!result.ok) {
        return fail(result.reason, joinPath(key, result.path));
      }
      cleaned[key] = result.value;
    }
    return pass(cleaned);
  };
}
