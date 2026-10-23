import { errorFor } from "../../../shared/errors.js";

// Rejects any body that doesn't match `schema` with a generic 400. The cleaned value (e.g.
// normalized names) is put on res.locals.body; handlers use that, never the raw req.body.
export function validateBody(schema) {
  return (request, response, next) => {
    const result = schema(request.body);
    if (!result.ok) {
      const { code, message } = errorFor("INVALID_PAYLOAD");
      response.status(400).json({ code, error: message });
      return;
    }
    response.locals.body = result.value;
    next();
  };
}
