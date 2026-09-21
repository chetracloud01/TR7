# TR7

Personal web app: a multi-LLM hub with live chat, plus a football
prediction module (automating the two-source EV/star/risk methodology in
`docs/MASTER_PLAN.md` §5) feeding a bankroll-controlled betting record
system.

See `docs/MASTER_PLAN.md` for the full architecture, data model, and build
order this repo follows.

## Layout

```
/frontend   Next.js (App Router) + TypeScript + Tailwind
/backend    FastAPI + SQLAlchemy + Alembic
/docs       Master plan and other project docs
docker-compose.yml   Postgres + backend + frontend for local dev
```

## Run locally

### Everything via Docker Compose

```
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build
```

- Frontend: http://localhost:3000 — logs in with `ADMIN_EMAIL`/`ADMIN_PASSWORD` from `backend/.env` (defaults: `you@example.com` / `changeme` — change these before running anywhere but your own machine)
- Backend: http://localhost:8000/api/health
- Postgres: localhost:5432 (user/pass/db: `tr7`)

There's no registration screen on purpose — this is a single-user app.
The first time the backend starts against an empty database it creates
exactly one user from those env vars.

### Frontend only

```
cd frontend
npm install
npm run dev
```

Needs a backend running (see below) for anything past the login screen —
`BACKEND_INTERNAL_URL` (defaults to `http://localhost:8000`) controls
where `next.config.ts` proxies `/api/*`.

### Backend only

```
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # point DATABASE_URL at a running Postgres
alembic upgrade head
uvicorn app.main:app --reload
```

## Where things stand

**Phase 1** (scaffolding): done. All 5 screens (Chat, Predict — Full Match
Board + Match Detail, Bankroll, Settings) as real Next.js routes, with the
prediction engine's math (EV, correct-score cascade, Kelly + risk-tier
staking) ported to TypeScript, and the full backend data model
(§4/§5/§6/§7) as SQLAlchemy models + Alembic migrations.

**Phase 2** (auth + settings screen): done.
- Session-cookie auth (single bootstrapped user, no public registration) —
  `/login`, and every `(app)` route redirects there server-side if you're
  not signed in.
- The LLM provider key vault in Settings is real: add/edit/test/remove a
  key per provider, encrypted at rest, masked on display. "Test" checks
  the key's format for now — an actual connectivity check to each
  provider is Phase 3 (LLM Gateway).
- The theme picker now persists to your account (`/api/preferences`) in
  addition to localStorage, so it's the same on a fresh browser once
  you're logged in — verified with a clean-profile browser in this repo's
  test pass.

Still mock/static: Chat, the Full Match Board, Bankroll, and the Model
Routing / Usage cards in Settings. Those go live in Phases 3–6 (LLM
Gateway, then each module wired to it in turn).
