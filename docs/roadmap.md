# Roadmap

Status: Proposed · Date: 2026-10-22 · Target: MVP in a real class next semester

## How to use this roadmap

- **One PR = one small behavior.** Aim for under about 300 changed lines, excluding the lockfile. If a PR grows past that, split it.
- **Branch names:** `<type>/<id>-<slug>`, e.g. `feat/3.6-vote-cast`, `chore/1.1-workspaces`.
- **Every PR follows the TDD cycle:**
  1. `test:` commit. Write the **Red tests** listed below and run them to show they fail for the expected reason. Stop for Dylan's review.
  2. `feat:` (or `fix:`/`chore:`) commit. Write the minimum code to pass.
  3. Optional `refactor:` commit. Lint and the full suite pass.
- **Tooling-only PRs** (marked ⚙️) change configuration rather than behavior. Where a behavior can be tested, such as a lint rule rejecting a fixture, the test still comes first. Otherwise the PR lists a **Verify** step instead of red tests.
- **Before merging** anything touching sockets, auth, or the database, run `/security-review`.
- Tick the box when the PR is merged.

Each PR lists:

- **Goal**
- **Files**
- **Red tests**, written as behavior statements
- **Green scope**: what to implement, and nothing more
- **Security checks**

Acceptance for every PR: red tests pass, nothing else regresses, and lint, the full suite, and coverage thresholds pass.

**Pace.** There are about 80 PRs, most of them 1–2 hours of work. At 6–8 hours a week that is roughly 5 PRs a week, or **about 16 weeks**. That is longer than the 10–14 week target, so the schedule is at risk. Options if it slips:

- Move the **deferrable** items marked ⏸ (CSV export) after launch.
- Combine adjacent tooling PRs (1.1 with 1.2, 1.4 with 1.5).
- Launch with phases 1–9, 10.1, and 10.4–10.7 plus phase 11. That is the minimum safe launch.

Re-check progress against this estimate after phase 3.

---

## Phase 0 — Planning documents

- [ ] **0.1 Planning docs.** Goal: architecture, ADRs, threat model, testing strategy, roadmap. Files: `docs/**`. Verify: Dylan's review; Mermaid renders on GitHub.
- [ ] **0.2 CLAUDE.md updates.** Goal: apply the approved CLAUDE.md diff. Files: `CLAUDE.md`. Verify: Dylan's review.

## Phase 1 — Repo, tooling, test infrastructure, CI

Every later phase can start with failing tests once this is done.

- [ ] **1.1 ⚙️ npm workspaces and formatting**
  - Goal: root `package.json` with `client`, `server`, and `shared` workspaces; Prettier; `.gitignore`; `.nvmrc` (Node 24); `.env.example` with placeholders.
  - Verify: `npm install` and `npm run format:check` succeed; `git check-ignore .env` prints `.env`.
  - Security: `.env.example` contains no real values.
- [ ] **1.2 ⚙️ ESLint 10 and Vitest with lint-rule tests**
  - Goal: flat ESLint config and a Vitest `shared` project.
  - Red tests:
    - lint rejects a fixture that uses `dangerouslySetInnerHTML`;
    - lint rejects `it.only`, `describe.skip`, `xit`, and `xtest`;
    - lint rejects `console.log` in `server/src`.
  - Green scope: `eslint.config.js` with `no-restricted-syntax` and `no-restricted-properties` rules; `vitest.config.js`.
  - Security: enforces CLAUDE.md security rule 8 and the no-skip rule by machine.
- [ ] **1.3 ⚙️ CI workflow**
  - Goal: GitHub Actions running lint, test, `npm audit --audit-level=high`, and a check that no `.env` file is tracked. Dependabot weekly.
  - Verify: workflow passes on the PR; pushing a dummy tracked `.env` on a scratch branch fails CI.
  - Security: actions pinned to commit SHAs; `permissions: contents: read`. Enable secret scanning and push protection in the repo settings.
- [ ] **1.4 ⚙️ Local Postgres with test database and roles**
  - Goal: `docker-compose.yml` (Postgres 17, `127.0.0.1` binding, credentials from `.env`); init script creating `planning_poker_test`, `pp_migrator`, and `pp_app`.
  - Verify: `docker compose up -d` and `psql` connects to both databases.
- [ ] **1.5 Migration runner**
  - Red tests:
    - applies unapplied migration files in filename order;
    - running twice applies nothing the second time;
    - a failing migration rolls back fully and stops later files;
    - two concurrent runs apply each file exactly once (advisory lock).
  - Green scope: `server/src/db/migrate.js`, `npm run migrate`, test fixture migrations, Vitest `server` project with `globalSetup` and `resetDb()`.
  - Security: runner logs file names only, never the connection string.
- [ ] **1.6 Config loader**
  - Red tests:
    - throws when `DATABASE_URL` is missing, naming the variable;
    - the error message never includes any variable's value;
    - rejects a non-numeric `PORT`;
    - `CLIENT_ORIGIN` must be a URL with no trailing path;
    - rate-limit and cap values parse from env with safe defaults.
  - Green scope: `server/src/config.js`.
- [ ] **1.7 App factory, health, 404, error handler**
  - Red tests:
    - `GET /health` returns 200 with exactly `{ status: "ok" }`;
    - an unknown API route returns a JSON 404 with a generic message;
    - a route that throws returns 500 `{ error: "Something went wrong" }` with no stack;
    - error details are logged server-side.
  - Green scope: `server/src/app.js` (`createApp`), `server/src/middleware/error-handler.js`.
  - Security: no stack traces in responses.
- [ ] **1.8 Security middleware**
  - Red tests:
    - responses carry helmet headers and the exact CSP from the threat model;
    - CORS allows `CLIENT_ORIGIN` and omits the allow header for other origins;
    - an 11 KB JSON body returns 413 generically;
    - with `trust proxy` 1, `req.ip` is the client IP from one proxy hop and ignores a spoofed extra hop.
  - Green scope: helmet, CORS, and body-limit wiring.
  - Security: T-10, T-15, T-16.
- [ ] **1.9 Socket.IO server and test harness**
  - Red tests:
    - a socket connection with no token is refused with a generic error;
    - a packet larger than 64 KB is rejected and the server keeps serving `/health`.
  - Green scope: `server/src/index.js` creating HTTP + Socket.IO with `maxHttpBufferSize`; handshake middleware refusing all connections for now; harness helpers (`startTestServer`, `connectClient`, `waitFor`, recorder).
  - Security: T-22.
- [ ] **1.10 Client skeleton and tokens**
  - Red tests:
    - `/` renders the "Planning Poker" heading and a "Not affiliated with RIT" footer;
    - an unknown route renders "Page not found" with a link home;
    - no `*.module.css` or JSX file contains a hex color or raw `px` value outside `tokens.css`.
  - Green scope: Vite + React + React Router; `tokens.css` (values from architecture §11.3); `global.css` with focus ring and reduced motion; Vitest `client` project (jsdom).
- [ ] **1.11 Playwright and first E2E**
  - Red tests:
    - the landing page loads at 375 and 1280 widths with zero axe violations;
    - there is no horizontal scroll at 360 px.
  - Green scope: `e2e/` config with `webServer`, `checkA11y` helper, e2e CI job.
- [ ] **1.12 ⚙️ Dev command**
  - Goal: `npm run dev` runs client and server together; Vite proxies `/api` and `/socket.io`.
  - Verify: `npm run dev`, then the landing page loads and `/api/health` returns ok through the proxy.

## Phase 2 — Shared contract and validators

- [ ] **2.1 Text normalization**
  - Red tests:
    - trims and collapses internal whitespace;
    - normalizes to NFC;
    - rejects control characters, bidi overrides (U+202A–202E, U+2066–2069), and zero-width characters;
    - length is counted after normalization.
  - Green scope: `shared/text.js`.
  - Security: T-11.
- [ ] **2.2 Validator helpers**
  - Red tests:
    - `exactKeys` rejects missing and extra keys, `__proto__`, and non-plain objects (arrays, null, class instances);
    - `string({ min, max })` rejects non-strings and bounds;
    - `uuid` accepts only UUID format;
    - `oneOf` and `arrayOf` (with min and max) behave as named.
  - Green scope: `shared/validate.js`.
  - Security: T-24.
- [ ] **2.3 Event names, limits, deck**
  - Red tests:
    - every client and server event name is unique and the objects are frozen;
    - `LIMITS` equal the CLAUDE.md caps;
    - `DECK.fibonacci` is exactly `0 1 2 3 5 8 13 21 ? ☕` and `NUMERIC_CARDS` excludes `?` and `☕`.
  - Green scope: `shared/events.js` (names and constants only).
- [ ] **2.4 Event payload schemas**
  - Red tests: for each client event, a valid payload passes, and each of {missing key, extra key, wrong type, oversize string, `__proto__`} returns `INVALID_PAYLOAD`. `story:add` accepts 50 titles and rejects 51.
  - Green scope: schemas beside each event in `shared/events.js`.
  - Security: CLAUDE.md required test "invalid or oversized payloads are rejected" (unit half).
- [ ] **2.5 Join codes**
  - Red tests:
    - generates 8 characters from the 31-symbol alphabet using the injected random function;
    - `parseCode` accepts lowercase and a dash, and rejects ambiguous characters;
    - `formatCode` inserts the dash.
  - Green scope: `shared/join-code.js` (format and parse) and `server/src/rooms/code.js` (generate with `crypto.randomInt`).
  - Security: T-06, CLAUDE.md security rule 5.
- [ ] **2.6 Error codes**
  - Red tests:
    - each error code maps to a constant message;
    - no message contains a template placeholder;
    - an unknown code maps to the generic message.
  - Green scope: `shared/errors.js`.
  - Security: T-03.

## Phase 3 — Room state machine (pure, test-first from architecture §4.1)

Every PR in this phase also asserts `assertInvariants(state)` after each successful reduction, and that rejected actions leave state unchanged.

- [ ] **3.1 State shape, builders, join and leave**
  - Red tests:
    - `createRoomState` seats the facilitator as a voter;
    - `participantJoined` adds a disconnected seat;
    - the 51st seat → `ROOM_FULL`;
    - a duplicate name ignoring case → `NAME_TAKEN`;
    - joining an ended room → `INVALID_STATE`;
    - `participantLeft` removes the seat.
  - Green scope: `server/src/rooms/state.js`, `reduce.js` skeleton, `test/builders.js`, `assertInvariants`.
- [ ] **3.2 Connect and disconnect**
  - Red tests:
    - connect sets `connected` and `connectedAt`;
    - disconnect sets `disconnectedAt`;
    - a facilitator disconnect emits a `scheduleHandoff` effect;
    - a facilitator reconnect emits `cancelHandoff`.
- [ ] **3.3 Role change and removal**
  - Red tests:
    - a voter switches to observer, and their open vote is removed;
    - an observer switches to voter;
    - the facilitator removes a participant, with a `disconnectParticipant` effect;
    - the facilitator removing themself → `INVALID_TARGET`;
    - a voter removing someone → `FORBIDDEN`.
- [ ] **3.4 Add stories**
  - Red tests:
    - the facilitator adds 3 titles with positions 0–2 as `pending`;
    - a voter adding → `FORBIDDEN`;
    - exceeding 200 total → `STORY_LIMIT`, with nothing added (all or nothing);
    - adding in `ended` → `INVALID_STATE`.
- [ ] **3.5 Select a story**
  - Red tests:
    - from `idle`, round 1 starts and status becomes `voting`;
    - selecting again while voting abandons the round and starts a new one;
    - re-selecting an estimated story starts the next round number;
    - an unknown story → `NOT_FOUND`;
    - a voter selecting → `FORBIDDEN`.
- [ ] **3.6 Cast and clear votes**
  - Red tests:
    - a voter casts 5, then 8 replaces it;
    - an observer voting → `FORBIDDEN`;
    - voting in `idle` or `revealed` → `INVALID_STATE`;
    - an old `roundId` → `STALE_ROUND`;
    - clearing removes the vote;
    - clearing with no vote → `NO_VOTE`.
- [ ] **3.7 Projections**
  - Red tests:
    - the public view while `voting` has `hasVoted` per participant and no `value` key at any depth;
    - the viewer view adds only the viewer's own vote;
    - an observer's viewer view has `myVote: null`;
    - after reveal, both views include all votes for the round;
    - neither view contains token hashes or `disconnectedAt`.
  - Green scope: `server/src/rooms/projections.js`.
  - Security: T-01, T-02 (unit half).
- [ ] **3.8 Reveal**
  - Red tests:
    - the facilitator reveals with ≥1 vote → `revealed`;
    - 0 votes → `NO_VOTES`;
    - a second reveal → `INVALID_STATE`;
    - a stale `roundId` → `STALE_ROUND`;
    - a voter revealing → `FORBIDDEN`.
- [ ] **3.9 Stats**
  - Red tests:
    - mean to one decimal, median, min, max, and distribution for numeric votes;
    - `?` and `☕` are counted separately and excluded from the math;
    - consensus is true only when all numeric votes are equal;
    - the suggestion is the median rounded up to a deck card;
    - all-`?` gives null numeric stats.
  - Green scope: `server/src/rooms/stats.js`.
- [ ] **3.10 Revote and accept**
  - Red tests:
    - revote starts round n+1 with no votes;
    - accepting 5 marks the story `estimated` and moves to `idle`;
    - accepting `?` → `INVALID_PAYLOAD`;
    - accepting from `voting` → `INVALID_STATE`.
- [ ] **3.11 Facilitator transfer, handoff, end**
  - Red tests:
    - transfer to a seated participant;
    - handoff after 60 s goes to the earliest-joined connected participant, skipping disconnected ones;
    - handoff at 59 s is a no-op;
    - with nobody connected, nothing changes;
    - if the facilitator has reconnected, it is a no-op;
    - `roomEnded` makes every later action `INVALID_STATE`.

## Phase 4 — Persistence

- [ ] **4.1 Schema migration 001**
  - Red tests:
    - migrations apply to an empty database;
    - a 41-character name, a 201-character title, an invalid join code, an invalid vote value, and `estimated` without an estimate are each rejected by the database;
    - deleting a room cascades to every child table.
  - Green scope: `server/src/db/migrations/001-initial-schema.sql` (architecture §7).
- [ ] **4.2 Least-privilege role**
  - Red tests:
    - `pp_app` can select, insert, update, and delete on app tables;
    - `pp_app` cannot `CREATE TABLE`, `DROP TABLE`, or `ALTER`.
  - Green scope: grants in a migration plus the init script.
  - Security: T-27.
- [ ] **4.3 Room and participant queries**
  - Red tests:
    - creating a room and its facilitator in one transaction returns ids;
    - `findRoomByCode` returns null for unknown codes;
    - `findParticipantByTokenHash` works;
    - a name containing SQL syntax is stored literally.
  - Green scope: `server/src/db/rooms.js`, `participants.js`, `pool.js`.
  - Security: T-26.
- [ ] **4.4 Story, round, and vote queries**
  - Red tests:
    - adding stories assigns positions;
    - starting a round increments `round_number`;
    - upserting a vote replaces it;
    - `revealed_at` is set on reveal;
    - every write updates `rooms.last_activity_at`.
- [ ] **4.5 Persist effects**
  - Red tests: for each successful reducer action type, `persist(prev, next, action)` produces database rows equal to the new state (table-driven over actions).
  - Green scope: `server/src/db/persist.js`.
- [ ] **4.6 Hydration**
  - Red tests:
    - a persisted room in each status hydrates to a state deep-equal to the original, apart from connection flags, which start disconnected;
    - a revealed round hydrates with its votes.
  - Green scope: `server/src/db/hydrate.js`.
- [ ] **4.7 Per-room serial queue**
  - Red tests (fake persist function):
    - events run in enqueue order;
    - B sees A's committed state;
    - a persist failure leaves state unchanged and the next event still runs;
    - two rooms run independently.
  - Green scope: `server/src/rooms/queue.js`.
- [ ] **4.8 RoomService**
  - Red tests:
    - `dispatch` reduces, persists, commits, and returns effects;
    - the first `getRoom` hydrates from the database;
    - a room unloads after 10 idle minutes (fake clock);
    - a rejected action never touches the database.
  - Green scope: `server/src/rooms/service.js` with injected clock and persistence.

## Phase 5 — HTTP create and join

- [ ] **5.1 Tokens**
  - Red tests:
    - a token is 32 random bytes as base64url;
    - the hash is SHA-256 (32 bytes);
    - comparison works for valid and invalid tokens;
    - the token module never logs.
  - Green scope: `server/src/auth/tokens.js`.
  - Security: CLAUDE.md security rule 5, ADR-003.
- [ ] **5.2 `POST /api/rooms`**
  - Red tests:
    - a valid body returns 201 with `{ code, participantId, rejoinToken }`;
    - a 61-character room name or a 41-character display name → 400;
    - extra keys → 400;
    - the database stores the token hash, not the token;
    - a join-code collision retries.
  - Green scope: `server/src/routes/rooms.js`, validation middleware.
- [ ] **5.3 `POST /api/rooms/:code/participants`**
  - Red tests:
    - returns 201 with a token;
    - unknown, ended, and malformed codes return identical 404s;
    - a duplicate name → 409 `NAME_TAKEN`;
    - a full room → 409 `ROOM_FULL`;
    - an observer role is honored.
- [ ] **5.4 Rate limits and capacity**
  - Red tests:
    - the 6th room creation from one IP within 10 minutes → 429;
    - 50 joins from one IP within a minute succeed (classroom NAT);
    - the 61st join → 429;
    - creation past the configured live-room cap → 503 `CAPACITY`.
  - Security: T-08, T-09, CLAUDE.md security rule 9.

## Phase 6 — Socket layer

- [ ] **6.1 Handshake authentication**
  - Red tests:
    - a valid token connects and `socket.data` holds the participant and room;
    - a wrong token or a removed participant's token is refused;
    - an 11th socket for the same participant is refused.
  - Security: T-17.
- [ ] **6.2 `room:join` and presence**
  - Red tests:
    - join returns `room:state` (viewer view) to that socket only;
    - other clients receive `participant:update` with `connected: true`;
    - a code that doesn't match the token's room → `FORBIDDEN`;
    - disconnecting the last socket broadcasts `connected: false`.
- [ ] **6.3 Handler wrapper**
  - Red tests:
    - each event's payload is validated before the queue;
    - a missing ack callback doesn't crash the server;
    - 25 events in 10 seconds → `RATE_LIMITED`, and continued flooding disconnects;
    - a thrown error acks generically and is logged without the payload.
  - Green scope: `server/src/sockets/wrap.js`.
  - Security: T-21, T-24.
- [ ] **6.4 Stories over sockets**
  - Red tests:
    - `story:add` broadcasts `story:update`;
    - `story:select` starts voting for everyone;
    - a voter's `story:add` → `FORBIDDEN` with no broadcast.
- [ ] **6.5 Votes over sockets, with the leak test**
  - Red tests:
    - `vote:cast` broadcasts `vote:status` with ids only;
    - the **recorder finds no vote values in any packet to any client before reveal**;
    - a reconnecting voter's `room:state` has their own vote only.
  - Security: T-01, T-02. CLAUDE.md required tests.
- [ ] **6.6 Reveal, revote, accept, and concurrency**
  - Red tests:
    - reveal broadcasts `round:revealed` with stats;
    - a double reveal produces exactly one broadcast;
    - over 50 iterations of vote vs reveal, the ack is ok iff the vote is revealed;
    - an injected persistence failure means no broadcast and unchanged state.
  - Security: T-20.
- [ ] **6.7 Authorization matrix suite**
  - Red tests: all 9 facilitator-only events from a voter and from an observer → `FORBIDDEN` and no broadcast.
  - Green scope: `server/test/security/authorization.test.js`.
  - Security: T-18, CLAUDE.md required test.
- [ ] **6.8 Leave, remove, set role, transfer**
  - Red tests:
    - a removed participant gets `room:removed`, is disconnected, and their token no longer connects;
    - setting the role to observer broadcasts the change and drops their vote;
    - a transfer moves controls.
- [ ] **6.9 End and delete**
  - Red tests:
    - `room:end` broadcasts `room:ended` and later actions fail;
    - `room:delete` with the wrong code confirmation is rejected;
    - the correct code deletes all rows and disconnects everyone with `reason: "deleted"`.

## Phase 7 — Client shell

- [ ] **7.1 API client**
  - Red tests:
    - maps 400, 404, 409, 429, and 503 to friendly messages;
    - network failure shows "Can't reach the server";
    - the token is never put in a URL.
  - Green scope: `client/src/api.js`.
- [ ] **7.2 Token storage**
  - Red tests:
    - saves and loads `{ participantId, token }` per room code;
    - "leave" deletes it;
    - storage that throws (private mode) falls back gracefully.
  - Green scope: `client/src/session.js`.
- [ ] **7.3 Landing page**
  - Red tests:
    - the "Create a room" link and the join-code field are keyboard reachable;
    - an invalid code shows an inline error tied to the field with `aria-describedby`.
- [ ] **7.4 Create room page**
  - Red tests:
    - fields have labels;
    - the 40-character limit is shown and enforced;
    - submit navigates to the room;
    - the button shows a loading state;
    - server errors render.
- [ ] **7.5 Join page**
  - Red tests:
    - the code is prefilled from the URL;
    - the "join as observer" option works;
    - "Name taken", "Room full", and "not found" messages render.
- [ ] **7.6 Socket connection hook**
  - Red tests (against the real test server):
    - `useRoom` connects with the stored token and exposes state from `room:state`;
    - applies `participant:update`, `vote:status`, `story:update`, and `round:revealed`;
    - exposes `connection: "connecting" | "connected" | "reconnecting" | "failed"`.
  - Green scope: `client/src/socket/`.

## Phase 8 — Voting room UI

- [ ] **8.1 Room page states**
  - Red tests: loading skeleton, not found, removed, ended, and disconnected banner (`role="alert"`) with controls disabled.
- [ ] **8.2 Participant list**
  - Red tests:
    - each row shows name, role, and a "Voted" or "Waiting" text label plus icon;
    - the facilitator is marked in text;
    - a disconnected participant is labelled "Offline".
- [ ] **8.3 Card deck component**
  - Red tests:
    - one Tab stop;
    - arrows, Home, and End move focus without voting;
    - Enter and Space select;
    - pressing the selected card clears it;
    - `aria-pressed` is set;
    - names are "5 points", "Unsure", and "Need a break";
    - targets are at least 44 px.
  - Green scope: `client/src/components/CardDeck`.
- [ ] **8.4 Vote wiring and announcements**
  - Red tests:
    - selecting a card emits `vote:cast` with the current `roundId`;
    - the status region announces "You voted 5" and the debounced progress "3 of 5 voters have voted".
- [ ] **8.5 Facilitator bar**
  - Red tests:
    - Reveal is disabled with 0 votes;
    - Reveal, Revote, and Next story emit the right events;
    - the bar is hidden for non-facilitators.
- [ ] **8.6 Backlog panel**
  - Red tests:
    - add one story;
    - paste 3 lines to add 3 stories, ignoring blank lines;
    - more than 50 lines shows an error;
    - selecting a story starts voting;
    - the panel collapses into a disclosure button at 375 px.
- [ ] **8.7 Reveal view**
  - Red tests:
    - votes are shown beside names;
    - stats are shown in text;
    - the median is preselected for accept;
    - "Votes revealed…" is announced;
    - the flip animation is skipped under reduced motion.
- [ ] **8.8 E2E: four voters complete a round**
  - Red tests: the journey in testing-strategy §8.1, with axe on each screen and screenshots at 375 and 1280.
  - Security: also asserts in the browser that no vote values appear in socket frames before reveal, via Playwright's `page.on("websocket")`.

## Phase 9 — Resilience

- [ ] **9.1 Rejoin flow**
  - Red tests:
    - refreshing the room page rejoins the same seat;
    - a missing or invalid stored token redirects to the join page with the code prefilled;
    - "Leave room" emits `room:leave` and deletes the token.
- [ ] **9.2 Handoff timer in RoomService**
  - Red tests (fake timers):
    - the handoff fires at 60 s;
    - a reconnect at 30 s cancels it;
    - after a restart, a facilitator absent for 60 s after hydration is handed off.
- [ ] **9.3 Facilitator tools UI**
  - Red tests:
    - remove participant (with confirmation dialog, focus trapped and returned);
    - transfer facilitator;
    - switch yourself to observer.
- [ ] **9.4 E2E resilience**
  - Red tests:
    - offline for 5 s and back, the vote is kept;
    - the facilitator closes the tab and another participant gains controls (short `HANDOFF_MS`).

## Phase 10 — End of session and data lifecycle

- [ ] **10.1 End session and summary**
  - Red tests:
    - "End session" asks for confirmation, then everyone sees the summary table of estimated stories;
    - actions are disabled afterwards.
- [ ] **10.2 ⏸ CSV export endpoint**
  - Red tests:
    - the facilitator token gets a CSV with a `Content-Disposition` attachment header;
    - a voter → 403, no token → 401, a `?token=` query → 401;
    - cells starting with `= + - @ TAB CR` are prefixed with `'`;
    - commas, quotes, and newlines round-trip.
  - Security: T-12, T-13.
- [ ] **10.3 ⏸ Export button**
  - Red tests:
    - the facilitator sees "Download CSV";
    - it fetches with the Authorization header and downloads a blob.
- [ ] **10.4 Delete room**
  - Red tests:
    - the facilitator must type the room code to confirm;
    - afterwards every participant sees "This room was deleted".
- [ ] **10.5 Retention job**
  - Red tests:
    - rooms inactive for more than 30 days are deleted with all children;
    - a room inactive for 29 days is kept;
    - deleted rooms are evicted from memory;
    - the job runs hourly (fake clock).
  - Green scope: `server/src/jobs/retention.js`.
- [ ] **10.6 Graceful shutdown**
  - Red tests:
    - on SIGTERM, the server stops accepting connections, finishes in-flight queue events, closes sockets and the pool, and resolves within 15 s;
    - a fresh server on the same database restores the room.
- [ ] **10.7 Privacy page and disclaimers**
  - Red tests:
    - `/privacy` lists the data collected, the retention (30 days + up to 7 days of backups), no tracking, and the contact;
    - the footer on every page links to it and says "Independent student project, not affiliated with RIT".

## Phase 11 — Self-hosted deployment and rollout

- [ ] **11.1 Production static serving**
  - Red tests:
    - in production mode, `/` serves `client/dist/index.html`;
    - `/room/ABCD-EFGH` falls back to `index.html`;
    - `/api/unknown` still returns a JSON 404.
- [ ] **11.2 ⚙️ Dockerfile**
  - Goal: multi-stage build (`npm ci`, build client, prune dev dependencies), runs as a non-root user, `HEALTHCHECK` on `/health`.
  - Verify: a CI job builds the image, runs it with a Postgres service, and `/health` returns 200. On `main`, CI pushes the image to GitHub Container Registry so the 1 GiB server never builds images itself.
- [ ] **11.3 ⚙️ Production Compose and Caddyfile**
  - Goal: `caddy`, `app`, `db` (no ports), `migrate` (one-shot, `pp_migrator`), `stop_grace_period: 15s`, `.env.example` production section.
  - Verify: `docker compose -f compose.prod.yml config` is valid; local run behind Caddy using `localhost` certificates.
- [ ] **11.4 ⚙️ Backups**
  - Goal: `scripts/backup.sh` (`pg_dump`, keep 7 days, `chmod 600`) and a documented cron entry.
  - Verify: a restore into a scratch database succeeds.
- [ ] **11.5 Docs**
  - Goal: README (setup, commands, self-hosting), SECURITY.md (private vulnerability reporting via GitHub), LICENSE, `docs/runbook.md` (deploy, rollback, restore, rotate secrets).
- [ ] **11.6 Server provisioning** (checklist, no code)
  - DigitalOcean Basic Droplet, 1 GiB, NYC region (ADR-006), with a 2 GB swap file; no provider disk backups;
  - SSH keys only, no root login;
  - firewall allows only 22, 80, 443;
  - unattended security upgrades;
  - Docker installed;
  - domain DNS points to the server;
  - `.env` created on the server only;
  - `nmap` from outside shows only 22, 80, 443.
- [ ] **11.7 Pilot session.** Run a full session with 4+ friends, including at least one on campus Wi-Fi (confirms T-09) and one on a phone that locks its screen mid-round.
- [ ] **11.8 Class-day rollout checklist** (below).

### Class-day rollout checklist

**Pre-deploy (the day before)**

- [ ] CI is green on `main`, including the e2e and audit jobs
- [ ] `/security-review` run on every merged PR touching sockets, auth, or the database
- [ ] Backup taken, and a restore tested within the last 30 days
- [ ] Migrations tested against a copy of the production database
- [ ] Rollback plan: previous image tag noted (`docker compose up -d app` with the old tag; forward-only migrations are backward compatible)

**Deploy**

- [ ] `docker compose -f compose.prod.yml pull && up -d`; the migrate service exited 0
- [ ] `curl https://<domain>/health` returns ok
- [ ] Smoke test: create a room on a phone and a laptop, vote, reveal, end, delete

**One hour before class**

- [ ] Server load and disk space are normal; the certificate is valid for more than 14 days
- [ ] Join from campus Wi-Fi works

**Rollback triggers**

- [ ] `/health` fails for more than 1 minute
- [ ] Any vote value visible before reveal (also stop using the app and investigate)
- [ ] Reconnection fails for more than one participant
- [ ] Server error rate is noticeable in logs (more than a few per minute)

**After class**

- [ ] Check logs for errors, without logging personal data
- [ ] Note issues as GitHub issues with fake data only

---

## Stretch goals (after MVP)

- T-shirt and custom decks
- Room lock (no new joins)
- Round timer
- Story reordering and descriptions
- CSV import of stories
- Installable app (PWA) for phones
