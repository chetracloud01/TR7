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

- Frontend: http://localhost:3000
- Backend: http://localhost:8000/api/health
- Postgres: localhost:5432 (user/pass/db: `tr7`)

### Frontend only (no backend wiring yet — pages use mock data)

```
cd frontend
npm install
npm run dev
```

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

Phase 1 of the master plan (scaffolding): done. The frontend has all 5
screens (Chat, Predict — Full Match Board + Match Detail, Bankroll,
Settings) wired up with real routing, a working token-based theme
switcher (see Settings → Appearance), and mock/placeholder data. The
backend has the full data model from the plan (§4/§5/§6/§7) and a health
endpoint, but no real API routes wired to the frontend yet, and no LLM
provider calls — that's Phases 2–6.
