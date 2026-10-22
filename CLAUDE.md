
# Planning Poker — Project Guide for Claude Code

A real-time planning poker website for scrum teams in RIT classes. A facilitator creates a room, teammates join with a code, everyone votes face-down on each story, the facilitator reveals, and the team agrees on an estimate.

This is an independent student project, self-hosted by Dylan. It is **not affiliated with or endorsed by RIT** and needs no RIT systems or accounts.

Planning docs: `docs/architecture.md`, `docs/adr/`, `docs/threat-model.md`, `docs/testing-strategy.md`, `docs/roadmap.md`. Work follows the roadmap one PR at a time.

Owner: Dylan (student developer). Explain any unfamiliar pattern, library, or API before using it — I need to understand and defend every line of this code.

## Stack (use only these unless I approve something new)

- **Frontend:** React (JavaScript, Vite), React Router, plain CSS with design tokens
- **Backend:** Node.js + Express (JavaScript, ES modules)
- **Realtime:** Socket.IO (server + `socket.io-client`)
- **Database:** PostgreSQL via the `pg` driver — hand-written SQL, no ORM
- **Testing:** Vitest (client + server), Supertest (HTTP routes), Playwright (end-to-end)
- **Tooling:** ESLint 10 + Prettier, Docker Compose (local Postgres and production), GitHub Actions CI
- **Hosting:** self-hosted Docker Compose (app, Postgres, one-shot migrate) behind Caddy for HTTPS (ADR-006)
- **Approved dev-only packages:** `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `jsdom`, `@axe-core/playwright`, `@eslint/js`, `globals`, `eslint-plugin-react-hooks`, `eslint-config-prettier`

Do not add new dependencies without asking first and explaining why the existing stack can't do it.

## Project structure

```
/client          React app (Vite)
  /src/components   Reusable UI components
  /src/pages        Route-level pages
  /src/styles       tokens.css (design tokens) + global styles
  /src/socket       Socket.IO client setup and event helpers
/server          Express + Socket.IO server
  /src/routes       HTTP routes (room creation, CSV export)
  /src/sockets      Socket event handlers (thin — call into /rooms)
  /src/rooms        Room state machine — pure logic, no sockets, no DB
  /src/db           pg pool, SQL queries, migrations
  /src/middleware   Validation, rate limiting, error handling
  /src/auth         Rejoin token generation and hashing
  /src/jobs         Retention job
  /test             Helpers, builders, socket harness, security suite
/shared          events.js (event names + payload schemas, source of truth), validate.js, text.js, join-code.js, errors.js
/e2e             Playwright tests
/docs            Architecture, ADRs, threat model, testing strategy, roadmap
```

## Commands

> Update these once the repo is set up.

- `docker compose up -d` — start local Postgres
- `npm run dev` — run client and server together
- `npm test` — all unit/integration tests
- `npm run test:e2e` — Playwright tests
- `npm run lint` — ESLint + Prettier check
- `npm run migrate` — apply database migrations

**Before saying any task is done:** run `npm run lint` and `npm test`, and report the results.

## Security rules (non-negotiable)

1. **Vote values are never sent to any client before the round is revealed.** Before reveal, broadcast only who has voted (`hasVoted: true`), never what. This must be enforced on the server, not hidden in the UI.
2. **All SQL uses parameterized queries** (`$1, $2, ...`). Never build SQL with string concatenation or template literals containing user input.
3. **Never trust the client.** Validate every HTTP request body and every socket payload on the server: check types, allowed values, and string lengths. Reject anything unexpected.
4. **Check authorization on every socket event.** Confirm the sender is a participant in that room and has the required role (e.g. only the facilitator can reveal, accept an estimate, or advance stories).
5. **Join codes and rejoin tokens are generated with `crypto`** (e.g. `crypto.randomUUID()` or `crypto.randomBytes`), never `Math.random()`.
6. **Secrets live in `.env`**, which is in `.gitignore`. Never commit, print, or log secrets. Do not read `.env` — use `.env.example` for variable names.
7. **Never log vote values, tokens, or personal data.**
8. **Never use `dangerouslySetInnerHTML`.** Render user text (names, story titles) as normal React text.
9. Express must use `helmet`, CORS restricted to the configured client origin, and `express-rate-limit` on room creation and joining.
10. Cap sizes: display names ≤ 40 chars, room names ≤ 60 chars, story titles ≤ 200 chars, ≤ 50 participants per room, ≤ 200 stories per room, ≤ 50 stories per `story:add`, ≤ 200 live rooms per server.
11. **Normalize user text** (NFC, trim, collapse whitespace) and reject control, bidi-override, and zero-width characters. Display names are unique per room, ignoring case.
12. **Limit socket traffic:** `maxHttpBufferSize` 64 KB, a per-socket rate limit, at most 10 sockets per participant. JSON bodies ≤ 10 KB.
13. **Escape CSV exports:** prefix `'` to any cell starting with `=`, `+`, `-`, `@`, tab, or carriage return, and quote every field.
14. **Strict Content-Security-Policy** via helmet (`default-src 'self'`); no inline scripts.
15. **Only the projection functions in `/server/src/rooms` may serialize room state** for clients. Error messages are constants and never include vote values or user input.
16. **Tokens never appear in URLs or logs.** They travel only in the Socket.IO handshake `auth` field or an `Authorization` header.

If a requested change would break any rule above, stop and tell me instead of doing it.

## Public repo and deployment rules

This repo is **public on GitHub** and the app is **self-hosted by Dylan for real use in RIT classes**. Assume anyone can read every file and every commit, forever.

- **Nothing private in the repo:** no secrets, API keys, database URLs, real student names, emails, screenshots with classmates' data, or database dumps. Use obviously fake seed data.
- **All configuration comes from environment variables** (`DATABASE_URL`, `CLIENT_ORIGIN`, `PORT`, `NODE_ENV`, etc.), documented in `.env.example` with placeholder values. Never hard-code URLs, ports, or origins.
- If a secret is ever committed, tell me immediately — it must be rotated, not just deleted (it stays in git history).
- **Production settings:** HTTPS only via Caddy; `app.set("trust proxy", 1)` (exactly one hop, Caddy; never `true`) so rate limiting sees real client IPs; secure, `httpOnly`, `sameSite` cookies if cookies are used; no stack traces or debug info in production responses.
- **Database in production:** migrations run as a deploy step, never by hand. The app connects with a least-privilege database user. Enable SSL on the database connection if the database is on another machine. Postgres has no published port; the host firewall allows only 22, 80, and 443.
- **Data minimization and retention:** collect only display names and estimates. Rooms and their data are deleted automatically after 30 days of inactivity. Backups rotate after 7 days, so the privacy page states a 37-day maximum. No analytics or tracking scripts without my approval.
- **Health check:** expose `GET /health` (returns 200, no sensitive info) for the Docker health check and uptime checks.
- **Graceful shutdown:** on SIGTERM, stop accepting connections, let every room's event queue finish (all accepted actions are already persisted), close Socket.IO and the DB pool, then exit within 15 seconds. Only one app instance runs at a time.
- **Branding:** RIT-inspired colors (orange `#F76902`, black, white) are fine. Never use RIT logos, wordmarks, the tiger, or seals. Every page footer, the README, and the privacy page say "Independent student project, not affiliated with RIT."
- Keep `README.md`, `SECURITY.md` (how to report a vulnerability), and `LICENSE` accurate when behavior or setup changes.

## Architecture rules

- **Room logic lives in `/server/src/rooms` as a pure state machine** (functions that take state + an action and return new state). Socket handlers only validate input, call the state machine, persist, and broadcast. This keeps the logic testable without sockets.
- **The server is the single source of truth.** Clients send intentions (`vote:cast`); the server decides and broadcasts the result. Simultaneous actions (two reveal clicks, a vote during reveal) must resolve to one consistent order.
- **Socket event names and payloads are defined in `/shared/events.js`.** Never invent an event name inline — add it there first.
- Live room state is held in server memory; write to Postgres on meaningful events (vote cast, reveal, estimate accepted, story added) so a refresh or restart doesn't lose work.
- **Reconnection:** a participant rejoining with a valid rejoin token (stored in localStorage) reclaims their existing seat and vote — never create a duplicate participant.
- **Event ordering:** each room processes events through a serial queue: validate → reduce → persist → commit to memory → broadcast → ack. Memory changes only after the database write succeeds (ADR-009).
- **Every client event uses a Socket.IO acknowledgement** returning `{ ok: true }` or `{ ok: false, error: { code, message } }`. Round actions carry `roundId` so stale clicks are rejected.
- **Facilitator handoff:** if the facilitator disconnects for 60 seconds or more, control passes to the earliest-joined participant who is currently connected. The facilitator can also transfer control manually.

## Socket event contract (summary — full shapes in /shared/events.js)

Client → server: `room:join`, `room:leave`, `story:add`, `story:select`, `vote:cast`, `vote:clear`, `round:reveal`, `round:revote`, `estimate:accept`, `participant:remove`, `participant:setRole`, `facilitator:transfer`, `room:end`, `room:delete`

Server → client: `room:state` (full snapshot on join/rejoin), `participant:update`, `vote:status` (who has voted — no values), `round:revealed` (values + stats), `story:update`, `room:ended`, `room:removed`, `error`

Full payloads, validation, and authorization per event: `docs/architecture.md` §5.

## Data model

- `rooms` (id, join_code, name, deck_type, facilitator_id, status [idle|voting|revealed|ended], current_story_id, created_at, last_activity_at)
- `participants` (id, room_id, display_name, role [voter|observer], rejoin_token_hash, joined_at, last_seen)
- `stories` (id, room_id, title, position, final_estimate, status [pending|estimated], created_at)
- `rounds` (id, story_id, round_number, started_at, revealed_at)
- `votes` (round_id, participant_id, value, cast_at) — primary key (round_id, participant_id)

The facilitator is `rooms.facilitator_id`; `role` is only voter or observer. Deck is Fibonacci only for the MVP: `0 1 2 3 5 8 13 21 ? ☕`. Full SQL with constraints: `docs/architecture.md` §7. The app connects as `pp_app` (data access only); migrations run as `pp_migrator`.

Store rejoin tokens hashed, not in plain text. Schema changes go through a new migration file — never edit an applied migration.

## Code style

- JavaScript ES modules, `async/await` (no raw promise chains or callbacks).
- Small, single-purpose functions and components. Prefer clear names over comments; comment the *why*, not the *what*.
- Handle errors explicitly. Server errors return a generic message to the client and log details on the server.
- No dead code, commented-out code, or leftover `console.log` in commits.

## Testing rules — test-driven development (TDD)

This project follows strict TDD. For every feature and bug fix, use the red → green → refactor cycle:

1. **Red:** Write the tests first, based on the acceptance criteria. Run them and show me that they fail for the expected reason (not because of a typo or missing import). Stop and let me review the tests before writing any implementation.
2. **Green:** Write the minimum implementation needed to make the tests pass. **Do not modify, weaken, skip, or delete tests to make them pass.** If a test seems wrong, stop and explain why instead of changing it.
3. **Refactor:** Clean up the code with all tests still passing. Run the full suite after refactoring.

Additional TDD rules:

- Commit the failing tests and the implementation as separate commits (`test: ...` then `feat: ...`) so the history shows tests came first.
- Never use `.skip`, `.only`, or `xit`/`xtest` in committed code.
- Never mock the code under test. Mock only external boundaries (network, time, randomness) and use a real test database for database tests. The only exception is queue-ordering and persistence-failure unit tests, which may use a fake persist function.
- Tooling-only PRs (config with no behavior) list a **Verify** step instead of red tests. If any part can be tested, such as a lint rule rejecting a fixture, the test still comes first.
- Tests describe behavior, not implementation details, so refactoring doesn't break them.
- Every bug fix starts with a failing test that reproduces the bug.
- Coverage target: 90%+ on `/server/src/rooms` and `/server/src/middleware`; 80%+ overall. Coverage is a check, not a goal — don't write tests just to raise it.
- The room state machine has thorough unit tests (it's where most bugs would hide).
- Required tests that must always exist and pass:
  - Vote values are not present in any broadcast before reveal.
  - Only the facilitator can reveal, re-vote, accept estimates, or change stories.
  - Rejoining with a valid token restores the same seat and vote.
  - Invalid or oversized payloads are rejected.
- E2E: a Playwright test with 4 simulated voters completing a full round.
- Every E2E screen runs an axe accessibility scan with zero violations allowed (replaces `eslint-plugin-jsx-a11y`, which doesn't support ESLint 10; see ADR-010).

## UI and design rules

- **Use the design tokens in `client/src/styles/tokens.css`** for all colors, spacing, font sizes, radii, and shadows. No hard-coded values in components.
- **Accessibility (WCAG 2.1 AA):**
  - Every interactive element works with the keyboard and has a visible focus state.
  - Cards can be selected with keyboard (arrow keys + Enter) and are announced correctly to screen readers.
  - Text meets AA contrast (4.5:1 normal text, 3:1 large text) in both light and dark mode.
  - Never use color alone to convey meaning (e.g. "voted" status also shows an icon or text).
  - Use semantic HTML (`button`, `main`, `nav`, headings in order) before reaching for ARIA.
- **Responsive:** must work from 360px phone width up to desktop. Test both.
- Respect `prefers-reduced-motion` for card flip animations.
- Every screen handles loading, empty, error, and disconnected states — no blank screens.
- Keep the voting screen focused: current story, cards, who has voted, and the facilitator's controls. Nothing else competes for attention.
- After UI changes, take Playwright screenshots at 375px and 1280px and check them against these rules.

## Workflow

1. Work on a feature branch, one roadmap PR per branch, named `<type>/<roadmap-id>-<slug>` (e.g. `feat/3.6-vote-cast`).
   Keep PRs very small: one behavior each, aiming for under ~300 changed lines excluding the lockfile. Split anything bigger.
2. For anything beyond a small fix, propose a plan first and wait for my approval.
3. Follow the TDD cycle above: failing tests first, my review, then implementation. Each PR has a `test:` commit before its `feat:` commit.
   Tick the PR's box in `docs/roadmap.md` when it merges.
4. Make small, reviewable changes. Explain what changed and why.
5. Run lint and the full test suite before calling a task done.
6. Before merging anything touching sockets, auth, or the database, run `/security-review`.
7. Never commit or push without my explicit go-ahead. Never force-push or rewrite history.
