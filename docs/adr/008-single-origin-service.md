# ADR-008: Serve the SPA, API, and sockets from one origin

**Status:** Proposed · **Date:** 2026-10-22 · **Deciders:** Dylan Ramdath

## Context

The React client could be hosted separately (a static host or CDN) or served by the same Node process as the API.

## Decision

In production, Express serves `client/dist` as static files, with `index.html` as the fallback for client-side routes. The API and Socket.IO share the same origin. In development, Vite's dev server proxies `/api` and `/socket.io` to the Node server, so development also behaves like a single origin.

CORS stays configured and restricted to `CLIENT_ORIGIN`, as CLAUDE.md requires. On one origin it is a second line of defense rather than the main control.

## Options considered

### Option A: Single origin (chosen)
**Pros:** one container to deploy; no cross-origin requests; a simpler Content-Security-Policy (`'self'`).
**Cons:** Node serves static files; negligible at this scale.

### Option B: Separate static host + API
**Pros:** CDN caching.
**Cons:** two deployments, cross-origin configuration, and a looser CSP.

## Consequences

- Helmet's CSP can be strict: `default-src 'self'`, with `connect-src 'self'` for the socket connection.

## Revisit when

- Static asset load becomes significant, which is unlikely.
