# Runbook

How to run Planning Poker on the self-hosted DigitalOcean droplet (ADR-006). Every command runs on the server unless noted.

## 1. Provision the server (once)

1. Create a **Basic Droplet**: Ubuntu LTS, 1 GiB RAM, New York region, with your SSH key added. No password login.
2. Point the domain's DNS `A` record (and `AAAA` for IPv6) at the droplet's IP. Wait until `dig +short your.domain` returns it.
3. Log in as root once, create your user, then lock down SSH:
   ```sh
   adduser deploy && usermod -aG sudo deploy
   rsync -a ~/.ssh /home/deploy/ && chown -R deploy:deploy /home/deploy/.ssh
   # /etc/ssh/sshd_config: PermitRootLogin no, PasswordAuthentication no
   systemctl restart ssh
   ```
4. Firewall: allow only SSH, HTTP, and HTTPS (threat model T-28 and T-30).
   ```sh
   ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw enable
   ```
   Docker can bypass `ufw` for published ports. Only Caddy publishes ports, so this is fine; never add `ports:` to `db`.
5. Automatic security updates: `apt install unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades`.
6. Swap, so a 1 GiB droplet survives memory spikes:
   ```sh
   fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   ```
7. Install Docker Engine and the Compose plugin (docs.docker.com/engine/install/ubuntu), then add your user to the `docker` group.
8. **Do not** turn on DigitalOcean's paid droplet backups. They keep weeks of copies, which would break the 37-day maximum on the privacy page. Use the nightly dump (section 5) instead.

Check from your own computer: `nmap -Pn your.domain` shows only 22, 80, and 443.

## 2. First deploy

1. In GitHub, open the repository's **Packages** → `ritplanningpoker` → **Package settings**, and set visibility to **Public**. The image contains no secrets (`.dockerignore`), and this lets the server pull without a token.
2. On the server:
   ```sh
   sudo mkdir -p /opt/planning-poker && sudo chown deploy: /opt/planning-poker
   git clone https://github.com/RamdathDylan/RITPlanningPoker.git /opt/planning-poker
   cd /opt/planning-poker
   cp .env.example .env && chmod 600 .env
   ```
3. Edit `.env`. Set `DOMAIN`, and replace **every** password with a long random value (`openssl rand -base64 32`). Never commit or share this file.
4. Start everything:
   ```sh
   docker compose -f compose.prod.yml pull
   docker compose -f compose.prod.yml up -d --wait
   docker compose -f compose.prod.yml logs migrate   # lists the applied migrations
   curl -s https://your.domain/health                 # {"status":"ok"}
   ```
5. Smoke test from a phone and a laptop: create a room, join, vote, reveal, end, and delete.

## 3. Deploy an update

CI publishes `ghcr.io/ramdathdylan/ritplanningpoker:latest` (and `:<commit-sha>`) for every push to `main` that passes all checks.

```sh
cd /opt/planning-poker
git pull                                    # compose file, Caddyfile, scripts
docker compose -f compose.prod.yml pull
docker compose -f compose.prod.yml up -d --wait
```

Compose sends the old container SIGTERM; it finishes in-flight actions and closes connections (graceful shutdown). The `migrate` service runs before the new app starts. Browsers show "Reconnecting…" for a few seconds, then rejoin the same seats. Avoid deploying during a class.

## 4. Roll back

Migrations only move forward and are written to stay compatible with the previous app version, so rolling back means running the previous image:

```sh
echo 'APP_IMAGE=ghcr.io/ramdathdylan/ritplanningpoker:<previous-commit-sha>' >> .env
docker compose -f compose.prod.yml up -d --wait
```

Remove that line again once a fixed version is on `main`.

## 5. Backups

Nightly at 03:15, keeping 7 days (`scripts/backup.sh`):

```sh
sudo mkdir -p /var/backups/planning-poker && sudo chown deploy: /var/backups/planning-poker
crontab -e
# 15 3 * * * cd /opt/planning-poker && ./scripts/backup.sh >> /var/log/planning-poker-backup.log 2>&1
```

**Restore** (test this at least once a month):

```sh
docker compose -f compose.prod.yml stop app
docker compose -f compose.prod.yml exec -T db psql -U "$POSTGRES_USER" -d postgres \
  -c "DROP DATABASE planning_poker" -c "CREATE DATABASE planning_poker OWNER pp_migrator"
gunzip -c /var/backups/planning-poker/<file>.sql.gz \
  | docker compose -f compose.prod.yml exec -T db psql -U "$POSTGRES_USER" -d planning_poker -v ON_ERROR_STOP=1
docker compose -f compose.prod.yml up -d --wait
```

Load `POSTGRES_USER` first with `set -a; . ./.env; set +a`.

## 6. Rotate a secret

If a password may have leaked (for example, it was committed), **rotate it**. Deleting the commit isn't enough, because it stays in git history.

- **App or migrator password:** connect with `docker compose -f compose.prod.yml exec db psql -U "$POSTGRES_USER" -d planning_poker`, then run `ALTER ROLE pp_app PASSWORD '<new>';` (or `pp_migrator`). Update `.env` and run `up -d`.
- **Superuser password:** `ALTER ROLE postgres PASSWORD '<new>';`, then update `.env`.
- Rejoin tokens can't leak from the database; only hashes are stored.

## 7. Class-day checklist

The full checklist, including rollback triggers, is in [`roadmap.md`](roadmap.md#class-day-rollout-checklist). In short:

- **Day before:** CI green on `main`; a backup exists and a restore was tested in the last 30 days.
- **One hour before:** `curl https://your.domain/health`; the certificate is valid for more than 14 days; joining from campus Wi-Fi works.
- **Roll back if:** `/health` fails for more than a minute, reconnection fails for several people, or **any vote is visible before reveal**. In that last case, stop using the app and investigate.

## 8. Troubleshooting

| Symptom                              | Check                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| Site down                            | `docker compose -f compose.prod.yml ps`; `logs app --tail 100`; `logs caddy`          |
| App won't start                      | `logs app`. "Invalid configuration" names the bad variable (values are never printed) |
| `migrate` failed                     | `logs migrate`; the app stays stopped until migrations succeed                        |
| HTTPS certificate errors             | DNS points at the droplet; ports 80 and 443 are open; `logs caddy`                    |
| Many "Too many requests" from campus | Raise `RATE_LIMIT_JOINS_PER_MIN` in `.env` (a class may share one IP), then `up -d`   |
| Disk filling up                      | `df -h`; `docker system prune` (unused images); backup folder size                    |

Logs are JSON lines and contain no vote values, tokens, or names (CLAUDE.md rule 7).
