# ADR-001: Use Socket.IO for realtime communication

**Status:** Proposed · **Date:** 2026-10-22 · **Deciders:** Dylan Ramdath

## Context

Everyone in a room must see "Alex voted" and the reveal within a fraction of a second. Phones on campus Wi-Fi drop connections often, for example when the screen locks. The server must push updates to clients, and clients must reconnect on their own.

## Decision

Use Socket.IO 4.8 on the server and `socket.io-client` in the browser, with acknowledgement callbacks for every client event.

## Options considered

### Option A: Socket.IO (chosen)

| Dimension   | Assessment                                                                    |
| ----------- | ----------------------------------------------------------------------------- |
| Complexity  | Low. Rooms, broadcast, reconnection, and acks are built in                    |
| Cost        | No extra infrastructure                                                       |
| Scalability | One process is plenty for about 30 rooms. Multi-server needs an adapter later |
| Familiarity | Already in the CLAUDE.md stack; large community                               |

**Pros:** automatic reconnection with backoff; rooms map directly onto planning-poker rooms; `emitWithAck` gives request/response semantics; falls back to HTTP long-polling on networks that block WebSockets.
**Cons:** a custom protocol on top of WebSockets, so plain WebSocket clients can't talk to it; larger client bundle; its lower layers (engine.io, socket.io-parser, ws) had several high-severity denial-of-service advisories in 2026, all fixed in the versions current today.

### Option B: Raw WebSockets with `ws`

**Pros:** smaller and closer to the standard.
**Cons:** reconnection, rooms, heartbeats, and acks would be hand-written. That is more code to own and test for no user-visible gain.

### Option C: Server-Sent Events plus HTTP POST

**Pros:** plain HTTP, so it is easy to rate-limit with existing middleware.
**Cons:** two channels to keep in sync, and reconnect state is still hand-written.

## Consequences

- Easier: reconnection and room broadcasts come for free; acks give a clean way to return validation errors.
- Harder: Socket.IO advisories must be watched. CI runs `npm audit`, and Dependabot is enabled.
- The handshake `auth` field carries the rejoin token, so no cookies are involved.

## Revisit when

- More than one server instance is needed. That requires a Socket.IO adapter backed by Redis or Postgres.
- Client bundle size becomes a measurable problem on phones.
