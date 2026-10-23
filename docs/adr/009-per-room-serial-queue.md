# ADR-009: Process each room's events through a serial queue

**Status:** Proposed · **Date:** 2026-10-22 · **Deciders:** Dylan Ramdath

## Context

CLAUDE.md requires simultaneous actions, such as two reveal clicks or a vote during a reveal, to resolve to one consistent order. Node runs one thread, but async handlers interleave at every `await`. Without care, two events could both pass their guards before either one saves.

## Decision

RoomService keeps one queue per room. Events for a room run strictly one after another: reduce → persist (await) → commit to memory → broadcast → ack. Different rooms run independently. Client events that operate on a round carry its `roundId`, so a stale click is rejected deterministically.

## Options considered

### Option A: Per-room serial queue (chosen)
**Pros:** ordering is obvious and testable; memory changes only after a successful write.
**Cons:** each event in a room waits for the previous one's write, a few milliseconds.

### Option B: Broadcast optimistically, persist afterwards
**Pros:** lowest latency.
**Cons:** a failed write leaves clients with state the database doesn't have; order of writes can differ from order of broadcasts.

### Option C: Database row locks
**Pros:** correct even with several servers.
**Cons:** harder to reason about and test; more queries per event.

## Consequences

- Concurrency tests become simple: fire two events without awaiting, then assert one consistent outcome.

## Revisit when

- Write latency makes votes feel slow, at which point batching writes is the next step.
