# ADR-003: Guest identity with a hashed rejoin token in localStorage

**Status:** Proposed · **Date:** 2026-10-22 · **Deciders:** Dylan Ramdath

## Context

No accounts and no university login: people join with a display name. The server must still know that a reconnecting phone is the same seat, and must stop anyone else from taking that seat or acting as the facilitator.

## Decision

On create or join, the server generates a 256-bit random token with `crypto.randomBytes(32)` and returns it once. The client stores it in localStorage and sends it in the Socket.IO handshake `auth` field, and as a Bearer header for CSV export. Postgres stores only `sha256(token)`.

A fast hash such as SHA-256 is fine here. Password hashes like bcrypt are deliberately slow to protect _guessable_ passwords, but a 256-bit random token cannot be guessed. Hashing exists so that a leaked database dump cannot be replayed as tokens.

## Options considered

### Option A: Token in localStorage (chosen; already required by CLAUDE.md)

| Dimension   | Assessment                                           |
| ----------- | ---------------------------------------------------- |
| Complexity  | Low                                                  |
| Security    | Readable by JavaScript, so an XSS bug could steal it |
| Familiarity | Simple to explain and debug                          |

**Pros:** no cookies, so no CSRF and no cross-site WebSocket hijacking; works per room; survives refresh.
**Cons:** XSS exposure; lost in private browsing or when storage is cleared.

### Option B: httpOnly session cookie

**Pros:** JavaScript can't read it, so XSS can't steal it.
**Cons:** needs CSRF protection and Origin checks on the socket handshake; one cookie covering several rooms is more complex.

### Option C: Accounts or university single sign-on

**Pros:** strong identity.
**Cons:** out of scope. The project has no university affiliation, and it would collect more personal data.

## Consequences

- XSS prevention becomes critical: no `dangerouslySetInnerHTML`, a strict Content-Security-Policy, and text-only rendering (threat model T-10).
- A person who loses their token rejoins as a new seat. The facilitator can remove the stale seat.

## Revisit when

- Any XSS finding, or a need for cross-device identity.
