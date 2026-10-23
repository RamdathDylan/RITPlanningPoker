# ADR-004: Hand-written payload validators in /shared

**Status:** Proposed · **Date:** 2026-10-22 · **Deciders:** Dylan Ramdath

## Context

Every HTTP body and socket payload must be checked for type, allowed values, length, and unexpected keys. There are about 18 payload shapes in total. CLAUDE.md asks for no new dependencies without a reason, and Dylan must be able to explain every line.

## Decision

Write a small set of composable validator helpers in `shared/validate.js`, used by both client and server. Examples are `exactKeys`, `string({ min, max })`, `oneOf`, `uuid`, `arrayOf`, and `normalizeText`. Each event's schema sits next to its name in `shared/events.js`. The client reuses them for instant form feedback, but the server is the authority.

## Options considered

### Option A: Hand-written helpers (chosen)

| Dimension   | Assessment                       |
| ----------- | -------------------------------- |
| Complexity  | Low to medium, roughly 150 lines |
| Cost        | No dependency                    |
| Familiarity | Plain functions                  |

**Pros:** every rule is visible and testable; no supply-chain risk; exactly the error codes we want.
**Cons:** we own the edge cases. Mitigated by the 90% coverage target on middleware and validators.

### Option B: zod 4 (4.6.7, actively maintained)

**Pros:** declarative schemas, `.strict()` rejects unknown keys, widely used.
**Cons:** a new dependency and API to learn; error output must still be mapped to our codes.

## Consequences

- Validators are among the first things built (roadmap phase 2), with tests written before them.

## Revisit when

- More than about 20 payload shapes, or a validation bug escapes to production.
