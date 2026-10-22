# ADR-002: In-memory authoritative room state with write-through to Postgres

**Status:** Proposed · **Date:** 2026-10-22 · **Deciders:** Dylan Ramdath

## Context

Every vote, reveal, and story change must be fast, consistently ordered, and must survive a server restart. Scale is small: one server, about 30 live rooms of up to 50 people.

## Decision

Each live room is held in server memory and changed only through the pure state machine. Every accepted action is written to Postgres **before** the in-memory state changes and before anything is broadcast. Rooms are loaded from Postgres on first use and unloaded when idle.

## Options considered

### Option A: Memory + write-through (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Medium. Needs hydration code and the per-room queue (ADR-009) |
| Cost | None beyond Postgres |
| Scalability | One process only |
| Familiarity | Plain JavaScript objects plus SQL |

**Pros:** reads cost nothing; the state machine stays pure and easy to test; restarts lose nothing that was acknowledged.
**Cons:** memory and database could drift if a write path is forgotten. Mitigated by a hydration round-trip test: persist, reload, compare.

### Option B: Database only
Every event reads the room from Postgres, applies the change, and writes it back.
**Pros:** no drift and no hydration logic.
**Cons:** several queries per vote, and concurrent events need row locks or serializable transactions, which are harder to reason about than a queue.

### Option C: Redis as the live store
**Pros:** shared across multiple servers.
**Cons:** another service to run, secure, and back up on a self-hosted machine. Not needed at this scale.

## Consequences

- Restarts are safe: clients reconnect and the room is rehydrated.
- Only one server process may run at a time. The Compose setup guarantees this (architecture §8.3).

## Revisit when

- More than one app instance is needed, or a room's state outgrows comfortable memory use, which is unlikely below thousands of rooms.
