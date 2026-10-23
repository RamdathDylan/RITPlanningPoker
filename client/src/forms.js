import { string } from "../../shared/validate.js";

// Checks a text field with the same rules the server uses and turns a failure into a
// message people can act on.
export function checkText(value, { max }) {
  const result = string({ min: 1, max })(value);
  if (result.ok) {
    return { value: result.value, error: null };
  }
  const error =
    result.reason === "contains unsupported characters"
      ? "Remove hidden or special control characters."
      : `Use 1 to ${max} characters.`;
  return { value: null, error };
}
