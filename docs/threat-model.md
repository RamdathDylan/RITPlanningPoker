# Threat model

Status: Proposed · Date: 2026-10-22 · Method: STRIDE

STRIDE is a checklist of six threat types: **S**poofing (pretending to be someone else), **T**ampering (changing data or messages), **R**epudiation (denying having done something), **I**nformation disclosure (leaking data), **D**enial of service (making the app unusable), and **E**levation of privilege (doing something your role shouldn't allow).

Each threat lists likelihood and impact (Low / Medium / High), the mitigation, the test that proves the mitigation, and the CLAUDE.md rule it maps to. "New" marks a rule proposed in the CLAUDE.md diff.

## 1. Assets and trust boundaries

**Assets, most sensitive first:**

1. Vote values before reveal (the core game integrity promise).
2. Rejoin tokens (control of a seat or the facilitator role).
3. Personal data: display names, story titles (may describe class projects), IP addresses held in memory for rate limiting.
4. Availability during a live class session.
5. Server secrets: `DATABASE_URL`, database role passwords, SSH keys.
6. Repository and supply chain integrity.

**Trust boundaries:**

- **B1** Internet → Caddy (HTTPS)
- **B2** Caddy → app (HTTP and WebSocket on the Compose network)
- **B3** app → Postgres
- **B4** Developer laptop / GitHub → the server (deploys)
- **B5** npm registry → `node_modules`

Everything from the browser is untrusted, including payload shapes, roles, room IDs, and timing.

## 2. Threats by component

### 2.1 Browser client

| ID | STRIDE | Threat | L / I | Mitigation | Proving test | Rule |
|---|---|---|---|---|---|---|
| T-01 | I | Voter reads others' votes before reveal in dev tools (network tab, React state) | High / High | The server never sends values before reveal. Projections emit `hasVoted` only; the client cannot leak what it never received | Socket test: packet recorder captures every packet to every client during a round, and no `value` key appears anywhere before `round:revealed` | Sec 1 |
| T-02 | I | Values leak through the reconnection snapshot | Medium / High | `toViewerView` adds only the viewer's own vote | Unit: viewer view for voter A while B has voted contains A's vote only. Socket: B reconnects mid-round and receives `myVote` = B's, no other values | Sec 1 |
| T-03 | I | Values leak through error messages or acks | Low / High | Error messages are constant strings per code; acks carry `{ ok }` or `{ code, message }` only | Unit: every error code's message is a constant without interpolation. Socket: invalid `vote:cast` ack contains no vote values | Sec 1, New |
| T-04 | S | Rejoin token stolen from localStorage via XSS | Low / High | See T-10 (XSS). Tokens are room-scoped and expire with the room | XSS tests (T-10) | Sec 8, ADR-003 |
| T-05 | I | Token leaks via URL, Referer, browser history, or logs | Medium / High | Tokens only in the handshake `auth` field and the `Authorization` header; never in URLs or logs; `Referrer-Policy: no-referrer` from helmet | Grep-style test: logger redaction unit test. HTTP test: export link uses a header, and a `?token=` query returns 401 | Sec 7 |

### 2.2 HTTP API (Express)

| ID | STRIDE | Threat | L / I | Mitigation | Proving test | Rule |
|---|---|---|---|---|---|---|
| T-06 | S/E | Join code guessed or brute-forced | Low / Medium | 31⁸ ≈ 8.5 × 10¹¹ codes from `crypto.randomInt`. At 30 live rooms and 60 tries a minute from one IP, one success takes on average about 900 years. Identical 404 for unknown and deleted codes. Facilitator can remove intruders | Unit: generator emits only alphabet characters, length 8, uses the injected crypto source. HTTP: unknown, ended, and deleted codes give byte-identical responses | Sec 5 |
| T-07 | I | Join code shared beyond the team (screenshot, group chat) | Medium / Low | The code is the invitation by design. Facilitator kick (`participant:remove`); room lock is a stretch goal | Socket: removed participant's socket gets `room:removed` and their token is rejected afterwards | Sec 4 |
| T-08 | D | Room creation flood | Medium / Medium | 5 creations per 10 min per IP; global cap of 200 live rooms → 503 | HTTP: sixth creation from one IP gets 429; cap test with a configured low limit returns 503 | Sec 9, New |
| T-09 | D | **Legitimate students blocked** by per-IP limits because a class shares one public IP (NAT) or one IPv6 /56 (express-rate-limit groups IPv6 by /56 by default) | Medium / High | Join limit 60 per minute per IP. Creation limit stays low. Limits are configurable via env. Verify from campus Wi-Fi in the pilot | HTTP: 50 joins from one IP within a minute all succeed. Manual: pilot session from campus Wi-Fi | New |
| T-10 | T/I | Stored XSS through display names or story titles | Medium / High | React renders text only; `dangerouslySetInnerHTML` banned by an ESLint rule; Content-Security-Policy `default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'` | Component test: a name `<img src=x onerror=alert(1)>` renders as literal text. HTTP test: CSP header exact match. Lint test: the rule rejects a fixture using the prop | Sec 8, New |
| T-11 | S | Lookalike or invisible-character names impersonate someone ("Alex" vs "Alex" with a Cyrillic А, or bidi overrides) | Medium / Low | NFC normalization; reject control, bidi-override (U+202A–202E, U+2066–2069), and zero-width characters; case-insensitive unique names per room | Unit: validator rejects each character class; second "alex" gets `NAME_TAKEN` | New |
| T-12 | T | CSV formula injection: a story title like `=HYPERLINK(...)` executes in Excel | Medium / Medium | Prefix `'` to any cell starting with `=`, `+`, `-`, `@`, tab, or carriage return; quote every field and double embedded quotes | Unit: each dangerous prefix is neutralized; round-trip of a title with commas, quotes, and newlines | New |
| T-13 | E | Non-facilitator downloads the export | Low / Low | Bearer token must belong to the room's current facilitator | HTTP: voter token → 403; no token → 401; other room's facilitator → 404 | Sec 4 |
| T-14 | I | Stack traces or SQL errors in responses | Medium / Medium | Central error handler returns generic messages; `NODE_ENV=production` | HTTP: route that throws returns `{ error: "Something went wrong" }` with no `stack` | Sec 3 |
| T-15 | D | Oversized or deeply nested JSON bodies | Medium / Medium | `express.json({ limit: "10kb" })`; exact-keys validation | HTTP: 11 KB body → 413 with a generic message | Sec 10 |
| T-16 | S | Rate limiter sees the proxy's IP, not the client's | High / High if wrong | `trust proxy` = 1 (exactly one hop: Caddy). Never `true`, which would trust a spoofed `X-Forwarded-For` | HTTP: with trust proxy 1, two different `X-Forwarded-For` values from the proxy count separately; a client-supplied extra hop is ignored | Deploy rules |

### 2.3 Socket layer and state machine

| ID | STRIDE | Threat | L / I | Mitigation | Proving test | Rule |
|---|---|---|---|---|---|---|
| T-17 | S | Connect as another participant | Low / High | Handshake requires a token whose hash matches; identity comes from `socket.data`, never from payloads | Socket: no token, wrong token, and another room's token are each refused | Sec 4 |
| T-18 | E | Voter or observer triggers facilitator actions | Medium / High | Every facilitator event checks `state.facilitatorId === socket.data.participantId` inside the reducer | Socket: for each of the 9 facilitator-only events, a voter and an observer both get `FORBIDDEN`, and no broadcast happens | Sec 4 (required test) |
| T-19 | E | Observer casts votes; voter votes in another room | Medium / Medium | Role guard in reducer; the room comes from `socket.data.roomId`, never from the payload | Socket: observer `vote:cast` → `FORBIDDEN`; a socket only receives broadcasts for its own room | Sec 4 |
| T-20 | T | Stale or replayed actions (double reveal, old `roundId`) | High / Low | Per-room serial queue; `roundId` guard | Socket: two concurrent reveals → exactly one `round:revealed`; vote with old `roundId` → `STALE_ROUND` | Arch |
| T-21 | D | Message flood from one socket | Medium / High | Token bucket of 20 events per 10 s; disconnect after repeated violations; max 10 sockets per participant | Socket: 25 rapid events → later ones get `RATE_LIMITED`; continued abuse disconnects | New |
| T-22 | D | Huge or binary-attachment packets exhausting memory (2026 socket.io-parser and engine.io advisories) | Medium / High | `maxHttpBufferSize` 64 KB; patched versions (socket.io-parser ≥ 4.2.7, engine.io ≥ 6.6.10, ws ≥ 8.21.0) enforced by lockfile and `npm audit` in CI | Socket: 100 KB payload is rejected and the server stays up. CI: audit step fails on high advisories | New |
| T-23 | D | Resource exhaustion: too many seats or stories | Medium / Medium | 50 seats, 200 stories, 50 titles per `story:add`, enforced in the reducer and by DB constraints | Unit: 51st join → `ROOM_FULL`; 201st story → `STORY_LIMIT` | Sec 10 |
| T-24 | T | Malformed payloads (wrong types, extra keys, prototype pollution keys like `__proto__`) | High / Medium | Exact-keys plain-object validation; `__proto__`, `constructor`, and `prototype` keys rejected | Table-driven: each event × {missing key, extra key, wrong type, too long, `__proto__`} → `INVALID_PAYLOAD` | Sec 3 (required test) |
| T-25 | R | Facilitator denies having removed someone or ended the room | Low / Low | Server logs facilitator actions as `{ event, roomId, actorId, at }`, ids only, no names or values | Logger unit test: entries have the expected fields and no name, token, or value | Sec 7 |

### 2.4 Database and host

| ID | STRIDE | Threat | L / I | Mitigation | Proving test | Rule |
|---|---|---|---|---|---|---|
| T-26 | T/I | SQL injection | Low / High | Parameterized queries only; review checklist; no string-built SQL | Integration: a name `'); DROP TABLE rooms;--` is stored literally. Lint: `no-restricted-syntax` flags template literals passed to `query()` | Sec 2 |
| T-27 | E | App compromise leads to schema destruction | Low / High | App connects as `pp_app` with DML only; migrations use `pp_migrator` | Integration: `pp_app` cannot `DROP TABLE` or `CREATE TABLE` | Deploy rules |
| T-28 | I | Postgres exposed to the internet | Medium / High | No `ports:` on the `db` service; host firewall allows only 22, 80, 443 | Deploy checklist: `nmap` from outside shows only 22, 80, 443 | New |
| T-29 | I | Backups retain deleted data or leak | Medium / Medium | 7-day rotation; backup directory readable only by root; privacy page states the 37-day maximum | Deploy checklist: cron job and permissions verified | New |
| T-30 | S/E | Server takeover via SSH or unpatched OS | Medium / High | SSH keys only, no root login, unattended security upgrades, Docker images rebuilt monthly | Deploy checklist | New |

### 2.5 Repository and supply chain

| ID | STRIDE | Threat | L / I | Mitigation | Proving test | Rule |
|---|---|---|---|---|---|---|
| T-31 | I | Secrets committed to the public repo | Medium / High | `.env` in `.gitignore`; `.env.example` with placeholders only; GitHub secret scanning and push protection enabled; if anything leaks, rotate it, because deleting a commit doesn't remove it from history | CI: a check fails if any `.env` file other than `.env.example` is tracked | Public repo rules |
| T-32 | I | Real student data in fixtures, screenshots, or issues | Medium / Medium | Fake names only (e.g. "Test Voter 1"); E2E screenshots use generated data; screenshots are not committed | Review checklist | Public repo rules |
| T-33 | T | Malicious or compromised npm package | Low / High | Few dependencies; lockfile committed; `npm ci` in CI and Docker builds; `npm audit --audit-level=high` in CI; Dependabot weekly; new dependencies need Dylan's approval | CI audit step | Stack rules |
| T-34 | T | Compromised GitHub Action | Low / High | Third-party actions pinned to full commit SHAs; workflow `permissions: contents: read` | CI config review | New |

## 3. Student privacy

| Data | Why | Where | Kept |
|---|---|---|---|
| Display name (nickname encouraged) | Show who voted | Postgres, memory | Until the room is deleted: 30 days of inactivity, or immediately on delete, plus up to 7 days in backups |
| Votes and story titles | The product itself | Postgres, memory | Same |
| Hashed rejoin token | Reclaim a seat | Postgres | Same |
| IP address | Rate limiting | Memory only, minutes | Not stored by the app; Caddy access logs disabled or IP-anonymized |

Not collected: email, real name, student ID, analytics, cookies, device fingerprints. The privacy page explains all of this in plain language. The app is run by an individual student, not RIT, so the page names Dylan as the contact.

## 4. Residual risks

- Anyone with a room code can join until the facilitator removes them. Room lock is a stretch goal.
- A person on a shared or public computer who doesn't leave the room leaves a token in that browser. Mitigated by a "Leave room" button that deletes it.
- Self-hosting puts availability on one machine. The deploy checklist includes a pre-class health check.
