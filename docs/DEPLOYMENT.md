# Deployment

TR7 is a personal, single-user app: one FastAPI backend, one Next.js
frontend, one Postgres database. This covers the two options
`docs/MASTER_PLAN.md` §10 left open — self-host vs. cloud — plus the
checklist that applies either way.

## Before deploying anywhere: generate real secrets

`backend/.env.example`'s `SECRET_ENCRYPTION_KEY`, `SESSION_SECRET`, and
`ADMIN_PASSWORD` are local-dev placeholders, checked into this public
repo in plaintext. The app **refuses to start** with
`ENVIRONMENT=production` if any of them is still that exact placeholder
(`app/core/config.py:assert_production_secrets`) — so this isn't
optional, it's enforced at process startup.

Generate real values:

```bash
# SECRET_ENCRYPTION_KEY — must be a real Fernet key, not an arbitrary string
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# SESSION_SECRET — any long random string
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# ADMIN_PASSWORD — whatever you'll actually log in with
```

Put all three (plus `ADMIN_EMAIL`, `POSTGRES_PASSWORD`, and
`ENVIRONMENT=production`) into `backend/.env`. Never commit that file —
it's already gitignored.

**Key rotation**: `SECRET_ENCRYPTION_KEY` encrypts LLM provider keys at
rest (`app/core/security.py`). Rotating it means re-encrypting every
stored `LLMProvider.api_key_encrypted` row: decrypt each with the old
key, encrypt with the new one, in one transaction, before swapping the
env var and restarting. There's no automated script for this (single
user, handful of provider rows) — do it by hand in a `python -m
app.db.session` shell using `app.core.security.decrypt_secret` /
`encrypt_secret`, or open an issue if this becomes a recurring need.

## Option A: self-host with Docker Compose

```bash
git clone <this repo> && cd TR7
cp backend/.env.example backend/.env   # then fill in real secrets, above
docker compose -f docker-compose.prod.yml --env-file backend/.env up -d --build
```

This starts three containers — `postgres`, `backend` (port 8000),
`frontend` (port 3000) — on a machine you control. The backend
container's entrypoint runs `alembic upgrade head` before starting
uvicorn, so migrations are never a separate manual step.

Postgres has no host port exposed in `docker-compose.prod.yml` (unlike
the dev compose file) — only reachable from the other containers on the
compose network. Nothing here terminates TLS: put a reverse proxy
(Caddy, nginx, or Traefik) in front of the frontend container for a real
domain + HTTPS. Caddy is the least config for a personal app — a
two-line Caddyfile (`your-domain.com { reverse_proxy localhost:3000 }`)
gets you automatic Let's Encrypt certs.

**Backups**: `scripts/backup_db.sh` wraps `pg_dump` against whatever
`DATABASE_URL` resolves to (reads `backend/.env` automatically). Run it
from a cron job on the host:

```cron
0 3 * * * cd /path/to/TR7 && ./scripts/backup_db.sh backups && \
  find backups -name 'tr7-*.sql.gz' -mtime +14 -delete
```

Restore with `scripts/restore_db.sh backups/tr7-<timestamp>.sql.gz` —
it asks for confirmation before dropping anything.

## Option B: cloud (Vercel + Railway/Fly.io)

- **Frontend → Vercel**: point it at `frontend/` as the project root.
  Set `BACKEND_INTERNAL_URL` to your deployed backend's URL (the
  `next.config.ts` rewrite still works — Vercel's edge network proxies
  `/api/*` to it server-side, so the session cookie stays first-party).
- **Backend + Postgres → Railway or Fly.io**: both give you a managed
  Postgres instance and a place to run the `backend/Dockerfile` image.
  Set the same env vars as the self-host path
  (`SECRET_ENCRYPTION_KEY`, `SESSION_SECRET`, `ADMIN_EMAIL`,
  `ADMIN_PASSWORD`, `ENVIRONMENT=production`, `DATABASE_URL` from
  whichever managed Postgres add-on you pick, `CORS_ORIGINS` set to
  your Vercel domain).
- **Migrations**: run `alembic upgrade head` as a release/predeploy
  step on whichever platform you pick (Railway and Fly.io both support
  a release command) — the same thing `docker-entrypoint.sh` does for
  the self-host path.
- **Backups**: use the managed Postgres provider's own automated
  backups (Railway and Fly.io Postgres both offer this) rather than
  `scripts/backup_db.sh`, which assumes host-level cron access you
  won't have on a managed platform.

Whichever you pick, the choice is yours to make per §10 of the master
plan — this repo doesn't hardcode one over the other.

## Rate limiting

Both the login endpoint and every LLM-cost-incurring endpoint (chat
send, football research) are capped in-process
(`app/core/rate_limit.py`) — 10 login attempts per 5 minutes, 20 LLM
calls per minute, per client IP. This is in-memory and per-process:
fine for the single-backend-container deployments above, but if you
ever run more than one backend replica behind a load balancer, each
replica tracks its own counts independently (effectively multiplying
the limit by replica count) — replace it with a shared store (Redis)
first if that matters to you.
