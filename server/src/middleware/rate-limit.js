import { rateLimit } from "express-rate-limit";
import { errorFor } from "../../../shared/errors.js";

// Counts requests per client IP (the real IP, thanks to `trust proxy`). IPv6 addresses are
// grouped by /56 subnet by default so one device can't dodge the limit by rotating addresses.
export function createRateLimiter({ windowMs, limit }) {
  const { code, message } = errorFor("RATE_LIMITED");
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => {
      response.status(429).json({ code, error: message });
    },
  });
}
