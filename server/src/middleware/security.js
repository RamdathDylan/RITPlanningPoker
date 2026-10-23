import cors from "cors";
import express from "express";
import helmet from "helmet";

const MAX_JSON_BODY = "10kb";

function contentSecurityPolicy({ isProduction }) {
  return {
    // Defaults are off so the policy is exactly what the threat model specifies (T-10).
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
    },
  };
}

export function applySecurityMiddleware(app, config) {
  // Exactly one proxy (Caddy) sits in front of the app. Trusting more hops would let
  // clients spoof their IP with X-Forwarded-For and dodge rate limits (threat model T-16).
  app.set("trust proxy", 1);

  app.use(helmet({ contentSecurityPolicy: contentSecurityPolicy(config) }));
  app.use(
    cors({
      origin: (origin, callback) => callback(null, origin === config.clientOrigin),
    }),
  );
  app.use(express.json({ limit: MAX_JSON_BODY }));
}
