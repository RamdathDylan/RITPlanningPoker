# Planning Poker

A real-time planning poker website for scrum teams in RIT classes. A facilitator creates a room, teammates join with a code, everyone votes face down on each story, the facilitator reveals the cards, and the team agrees on an estimate.

Independent student project by Dylan Ramdath. **Not affiliated with or endorsed by RIT.**

## Features

- Rooms with an 8-character join code (`ABCD-EFGH`); no accounts. People join with a display name.
- Facilitator, voter, and observer roles; the facilitator can hand off control, remove people, end the session, and delete the room.
- Fibonacci deck (`0 1 2 3 5 8 13 21 ? ☕`). Votes stay hidden on the server until the reveal.
- Stats on reveal (average, median, range, agreement) and a suggested estimate.
- Reconnection: a refresh or dropped phone gets the same seat and vote back. If the facilitator is gone for 60 seconds, control passes on automatically.
- End-of-session summary with a formula-safe CSV export.
- Keyboard-first and screen-reader friendly (WCAG 2.1 AA), light and dark themes, from 360 px phones to desktop.
- Rooms are deleted automatically after 30 days of inactivity. See the in-app privacy page.

## Tech stack

React + Vite, Node.js + Express, Socket.IO, and PostgreSQL with hand-written SQL. Tests use Vitest, Supertest, and Playwright. It deploys with Docker Compose behind Caddy. Design decisions are in [`docs/adr/`](docs/adr/).

## Local development

You need Node.js 24 and Docker.

```sh
cp .env.example .env          # then replace every placeholder password
npm install
npx playwright install chromium
docker compose up -d --wait   # Postgres with dev and test databases
npm run migrate
npm run dev                   # http://localhost:5173
```

| Command                 | What it does                                                  |
| ----------------------- | ------------------------------------------------------------- |
| `npm run dev`           | Server (port 3000, restarts on changes) and Vite together     |
| `npm test`              | Unit and integration tests (needs Postgres running)           |
| `npm run test:coverage` | Tests with coverage thresholds, as in CI                      |
| `npm run test:e2e`      | Playwright end-to-end tests (builds the client first)         |
| `npm run lint`          | ESLint and Prettier check (`npm run format` fixes formatting) |
| `npm run migrate`       | Apply database migrations                                     |

## Project layout

```
client/   React app            server/   Express + Socket.IO server
shared/   Event names, validators, and limits used by both
e2e/      Playwright tests     docs/     Architecture, ADRs, threat model, testing, roadmap, runbook
```

## Self-hosting

The app runs on one server with Docker Compose (`compose.prod.yml`): Caddy for HTTPS, the app, a one-shot migration step, and Postgres. Images are built and published by CI. See [`docs/runbook.md`](docs/runbook.md) for setup, deploys, rollbacks, and backups.

## Security and privacy

Please report vulnerabilities privately; see [`SECURITY.md`](SECURITY.md). The app collects only display names, room and story names, and votes. It has no analytics or tracking. The threat model is in [`docs/threat-model.md`](docs/threat-model.md).

## License

[MIT](LICENSE)
