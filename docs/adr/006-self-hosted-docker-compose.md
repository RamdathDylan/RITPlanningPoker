# ADR-006: Self-host with Docker Compose behind Caddy

**Status:** Accepted · **Date:** 2026-10-22 · **Deciders:** Dylan Ramdath

## Context

Dylan hosts the app personally, with no university infrastructure involved. The deployment needs HTTPS, an always-on process (sleeping hosts drop live sockets), Postgres with backups, migrations as a deploy step, and safe restarts. It must be simple enough for one person to run.

**Machine:** a DigitalOcean Basic Droplet (1 GiB, NYC region), accepted by Dylan on 2026-10-22. See "Server recommendation" below.

## Decision

Run three services with Docker Compose on one Linux machine:

| Service   | Image                                                       | Role                                                                                               |
| --------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `caddy`   | `caddy:2`                                                   | Reverse proxy on ports 80/443. Gets and renews HTTPS certificates automatically from Let's Encrypt |
| `app`     | built from the repo's `Dockerfile` (Node 24, non-root user) | Express + Socket.IO + built client. Not published to the internet directly                         |
| `db`      | `postgres:17`                                               | Data on a named volume. No published port                                                          |
| `migrate` | same image as `app`, different command                      | One-shot; `app` waits for it with `depends_on: condition: service_completed_successfully`          |

Plus a nightly backup job (`pg_dump`, 7-day rotation) via cron on the host.

Docker Compose describes several containers and how they connect in one YAML file. It is already used in CLAUDE.md for local Postgres, so production uses the same tool. **Caddy** is a web server that handles HTTPS certificates automatically with a few lines of config. It is new to the stack and runs as a container, not an npm dependency.

## Options considered

### Option A: Docker Compose + Caddy (chosen)

| Dimension   | Assessment                                                        |
| ----------- | ----------------------------------------------------------------- |
| Complexity  | Medium. Compose and a 5-line Caddyfile                            |
| Cost        | VPS about $4–6/month, or a home machine plus a domain (~$12/year) |
| Scalability | One machine; fine for this load                                   |
| Familiarity | Compose is already used for local development                     |

**Pros:** production matches local development; one command to deploy; HTTPS without manual certificate work; the database is never exposed.
**Cons:** Dylan is responsible for OS updates, the firewall, backups, and uptime.

### Option B: Node under systemd + nginx + certbot

**Pros:** no container layer.
**Cons:** more manual setup; production differs from local development; certificate renewal is another moving part.

### Option C: Managed platform (Railway, Render)

**Pros:** less operations work.
**Cons:** rejected by the owner, who chose to self-host.

## Server recommendation

### Sizing

| Process                    | Approximate memory |
| -------------------------- | ------------------ |
| Ubuntu + Docker            | 250–350 MB         |
| Postgres 17 (small config) | 100–200 MB         |
| Node app                   | 100–200 MB         |
| Caddy                      | 20–40 MB           |

That totals about 0.5–0.8 GB. **1 GB RAM with a 2 GB swap file** is enough, provided Docker images are **built in GitHub Actions and pushed to GitHub Container Registry** rather than built on the server, because builds need far more memory than running. 2 GB is comfortable headroom. Pick a data center in the **US East (New York or Virginia)**, closest to Rochester, for the lowest latency.

### Options compared (prices checked 2026-10-22)

| Provider                       | Plan                                                                        | Monthly                       | Notes                                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DigitalOcean (recommended)** | Basic Droplet, 1 vCPU / 1 GiB / 25 GiB SSD / 1,000 GiB transfer, NYC region | **$6** (2 GiB: $12)           | From digitalocean.com/pricing/droplets. Student-friendly docs. The GitHub Student Pack DigitalOcean credit is no longer offered (confirmed by Dylan, 2026-10-22) |
| AWS Lightsail                  | 1 GB / 2 vCPU burst / 40 GB / 2 TB, Virginia                                | $7 (2 GB: $12)                | From aws.amazon.com/lightsail/pricing. Fixed price including IPv4; AWS console is more complex                                                                   |
| Azure for Students             | Small B-series VM                                                           | $0 until $100 credit runs out | Via GitHub Student Pack, no card required (education.github.com/pack). Credit lasts about a year, then you must migrate or pay                                   |
| Hetzner                        | CPX11, 2 vCPU / 2 GB, Ashburn                                               | €17.99                        | hetzner.com: US plans now cost much more than EU plans and showed "currently unavailable". EU plans (€6.49) add ~100 ms latency from Rochester                   |
| Oracle Cloud Always Free       | Ampere A1                                                                   | $0                            | Reports say the free allowance was cut in mid-2026; idle instances can be reclaimed; US East capacity often unavailable. Too risky for live classes              |
| Home machine                   | —                                                                           | $0 + electricity              | Exposes your home IP; residential ISPs may block ports 80/443 or change your IP; uptime depends on home power and Wi-Fi                                          |

**Recommendation: DigitalOcean Basic Droplet, 1 GiB, NYC region, about $6/month.** Upgrade to 2 GiB ($12) if memory runs tight; resizing takes a few minutes. Add a domain name (about $10–15 a year from any registrar), since Caddy needs one to get an HTTPS certificate. Budget: about $6/month plus the domain, roughly $82–87 for the first year.

**Backups:** do **not** turn on the provider's whole-disk backups. They keep weeks of copies, which would break the 37-day maximum on the privacy page. Use the nightly `pg_dump` rotation instead.

Sources: digitalocean.com/pricing/droplets, aws.amazon.com/lightsail/pricing, hetzner.com/cloud/regular-performance, education.github.com/pack, and third-party reports on Oracle's 2026 Always Free changes (braindetox.kr, space-node.net).

## Consequences

- Graceful shutdown must finish within Compose's `stop_grace_period` (15 s).
- Only one `app` container ever runs, which ADR-002 relies on.
- The host needs: automatic security updates, an SSH key-only login, and a firewall allowing only 22, 80, and 443.
- Backups extend data lifetime by up to 7 days. The privacy page states this.

## Revisit when

- Uptime or maintenance becomes a burden, at which point a managed platform is the fallback. The same Dockerfile runs there.
