# Testing strategy

Status: Proposed · Date: 2026-10-22

The project follows strict TDD, as CLAUDE.md requires:

1. **Red.** Write the failing tests and show they fail for the right reason.
2. **Review.** Dylan reviews the tests.
3. **Green.** Write the minimum implementation to pass, without weakening any test.
4. **Refactor** with all tests still passing.

Every PR has a `test:` commit before its `feat:` commit.

## 1. Test levels

| Level          | Tool                                                                                   | Runs against                   | What it proves                                                            | Speed    |
| -------------- | -------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------- | -------- |
| Unit           | Vitest (node)                                                                          | Pure functions                 | Game rules, projections, stats, validators, CSV escaping, code generation | ms       |
| Component      | Vitest + jsdom + Testing Library + user-event                                          | React components               | Rendering, keyboard behavior, ARIA, states                                | ms–s     |
| DB integration | Vitest + real Postgres                                                                 | `db/` queries and migrations   | Constraints, persist/hydrate round trip, retention                        | s        |
| HTTP           | Vitest + Supertest + real Postgres                                                     | Express app from `createApp()` | Validation, rate limits, headers, auth, export                            | s        |
| Socket         | Vitest + real Socket.IO server on port 0 + several `socket.io-client`s + real Postgres | Handlers + RoomService         | Authorization, hidden votes, broadcasts, concurrency, reconnection        | s        |
| E2E            | Playwright + axe                                                                       | Built app + Postgres           | Full user journeys, accessibility, responsive layout                      | 10s of s |

The pyramid shape: most tests are unit tests on `server/src/rooms` and `shared/`. Socket tests cover the security guarantees end to end. E2E is a handful of journeys.

## 2. Must-pass security tests (from the threat model)

These form `server/test/security/` and must never be skipped or weakened.

| Test (behavior statement)                                                                                         | Level                                     | Threat             |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------ |
| No packet sent to any client before `round:revealed` contains a vote value                                        | Socket (recorder)                         | T-01               |
| A reconnecting voter's `room:state` contains their own vote and no one else's                                     | Socket                                    | T-02               |
| Error acks and messages never contain vote values                                                                 | Unit + socket                             | T-03               |
| Each facilitator-only event from a voter or observer is rejected with `FORBIDDEN` and causes no broadcast         | Socket (table-driven, 9 events × 2 roles) | T-18               |
| Rejoining with a valid token restores the same participant id, seat, and vote, and creates no new participant row | Socket + DB                               | CLAUDE.md required |
| Each event rejects missing keys, extra keys, wrong types, oversize strings, and `__proto__` keys                  | Unit (validators) + socket (sample)       | T-24               |
| Oversized HTTP bodies (413) and socket packets (rejected, server stays up)                                        | HTTP + socket                             | T-15, T-22         |
| Handshake without, with a wrong, or with another room's token is refused                                          | Socket                                    | T-17               |
| Join codes: alphabet, length, crypto source; identical 404s                                                       | Unit + HTTP                               | T-06               |
| XSS payload names render as literal text; CSP header present                                                      | Component + HTTP                          | T-10               |
| CSV cells starting with `= + - @ TAB CR` are neutralized                                                          | Unit                                      | T-12               |
| `pp_app` cannot run DDL                                                                                           | DB integration                            | T-27               |

## 3. Room state machine: test-first from the transition table

**Recommendation: yes, design it test-first from the table** in `architecture.md` §4.1.

The table is already a specification. Each row becomes `test.each` cases before any reducer code exists:

- **Allowed path.** For each action, in each allowed status, by the allowed actor → expected new state and effects.
- **Wrong actor.** Same action by each other role → `FORBIDDEN`, state unchanged (same object contents).
- **Wrong status.** Same action in each disallowed status → `INVALID_STATE`.
- **Each guard.** One case per guard (`ROOM_FULL`, `NAME_TAKEN`, `STALE_ROUND`, `NO_VOTES`, …).
- **Invariants**, checked after every successful reduction in every test through a shared `assertInvariants(state)` helper:
  - at most one facilitator, and they are seated;
  - votes exist only for seated voters, in the current round;
  - status `voting` implies a current story and round;
  - story count ≤ 200, seat count ≤ 50.

Writing the table cases first forces every unclear rule to be decided before coding.

## 4. Concurrency and reconnection

- **Queue unit tests.** These use a fake persistence function that resolves when the test says so, which mocks the database boundary only. Enqueue A and B, resolve them, and assert the order applied equals the order enqueued and that B saw A's result.
- **Double reveal (socket).** The facilitator emits `round:reveal` twice without awaiting. Exactly one `round:revealed` reaches each client. One ack is ok; the other is `INVALID_STATE`.
- **Vote vs reveal (socket).** Fire `vote:cast` and `round:reveal` back to back, 50 iterations. Invariant: a vote's ack is ok **if and only if** that vote appears in `round:revealed`.
- **Persistence failure.** Inject a failing write once (test-only pool wrapper that throws). The ack is a generic error, no broadcast happens, and in-memory state is unchanged.
- **Reconnection (socket).** The voter votes, `socket.disconnect()`, reconnects with the same token. Same `participantId`, `myVote` restored, participant count unchanged, other clients see connected → disconnected → connected.
- **Restart (socket).** Stop the test server (graceful shutdown path), start a new one on the same test database, reconnect. State is identical.
- **E2E.** `context.setOffline(true)` for 5 s, then back online. The banner appears, then disappears, and the vote is still shown as cast.

## 5. Time: facilitator handoff and retention

- RoomService receives `clock = { now, setTimeout, clearTimeout }` as a dependency. Production passes the real functions.
- **Service-level tests** use `vi.useFakeTimers()` and `vi.advanceTimersByTime(60_000)`:
  - handoff after 60 s;
  - no handoff at 59 s;
  - reconnecting at 30 s cancels the timer;
  - handoff goes to the earliest-joined connected participant;
  - nobody connected → no change.
- **Socket-level tests** don't use fake timers, because they would freeze Socket.IO's own heartbeats. They set `HANDOFF_MS=200` through config.
- **Retention** takes `now` as a parameter. The test inserts rooms with old `last_activity_at` values and asserts which ones are deleted, including cascades.

## 6. Test infrastructure (built in roadmap phase 1, before any feature)

| Piece           | Location                                              | Description                                                                                                                                                                                                                        |
| --------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest projects | `vitest.config.js`                                    | `shared` (node), `server` (node, DB tests run serially with `fileParallelism: false`), `client` (jsdom)                                                                                                                            |
| Test database   | `docker-compose.yml` + `docker/initdb/01-test-db.sql` | Creates `planning_poker_test` beside the dev database, plus `pp_app` and `pp_migrator` roles                                                                                                                                       |
| Global setup    | `server/test/global-setup.js`                         | Runs migrations once against the test database                                                                                                                                                                                     |
| Per-test reset  | `server/test/helpers/db.js`                           | `resetDb()` runs `TRUNCATE rooms CASCADE` in `beforeEach`                                                                                                                                                                          |
| Socket harness  | `server/test/helpers/socket-harness.js`               | `startTestServer(overrides)` → `{ url, close }`; `connectClient(url, token)` with `forceNew: true`, `reconnection: false` unless a test opts in; `waitFor(socket, event, { timeout })`; `emitWithAck` is built into Socket.IO 4.6+ |
| Packet recorder | `server/test/helpers/recorder.js`                     | Wraps a client with `socket.onAny()` (a Socket.IO listener for every incoming event), storing `[event, payload]`. `findKeyDeep(packets, "value")` scans nested objects for leaks                                                   |
| Builders        | `server/test/builders.js`                             | `buildRoomState({ status, voters: 3, votes: { 0: "5" } })` for unit tests; `createRoomViaApi()` and `joinViaApi()` for integration tests                                                                                           |
| Fake data       | builders                                              | Names like "Test Voter 1"; never real names                                                                                                                                                                                        |
| Clock           | test helper                                           | `fakeClock()` wraps Vitest fake timers into the RoomService `clock` shape                                                                                                                                                          |
| E2E             | `e2e/playwright.config.js`                            | `webServer` starts the built app against the test database; `projects` for 375×812 and 1280×800; a `checkA11y(page)` helper wraps `@axe-core/playwright`                                                                           |
| Coverage        | `vitest.config.js`                                    | v8 provider; thresholds `server/src/rooms/**` 90, `server/src/middleware/**` 90, global 80                                                                                                                                         |
| CI              | `.github/workflows/ci.yml`                            | Jobs: lint → unit/integration (Postgres service container) → e2e (from phase 8) → `npm audit --audit-level=high`                                                                                                                   |

**What may be mocked:** only external boundaries. That means the clock, randomness (inject a random source), and the database **only** in queue-ordering and persistence-failure unit tests. Everything else uses the real implementation and a real Postgres.

## 7. Client tests

- **Card deck (component).**
  - Tab enters the deck at the selected or first card.
  - Arrows move focus without voting.
  - Enter and Space vote; pressing the selected card clears.
  - Home and End work.
  - `aria-pressed` reflects the selection.
  - Accessible names are "5 points", "Unsure", "Need a break".
- **Who-voted list.** Status appears as text and an icon, not color alone.
- **Live region.** Announcements appear for progress, reveal, facilitator change, and connection loss.
- **States.** Every page renders loading, empty, error, and disconnected variants.
- **Socket client wrapper.** Tested against the real test server in the socket suite rather than mocked.

## 8. E2E journeys (Playwright)

1. **Four voters complete a round.** Required by CLAUDE.md. Four browser contexts (separate localStorage) plus one facilitator: create a room, join, add stories, vote, reveal, accept, export CSV. axe scan on each screen.
2. **Reconnection.** One voter goes offline mid-round and returns with their vote intact.
3. **Facilitator handoff.** Facilitator's context closes; another participant gains controls (with `HANDOFF_MS` shortened).
4. **Keyboard-only round.** No mouse.
5. **Screenshots** at 375 and 1280 for each screen, attached to the CI artifacts and reviewed against the UI rules. They are not committed.
