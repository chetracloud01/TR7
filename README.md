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
  key per provider, encrypted at rest, masked on display.
- The theme picker now persists to your account (`/api/preferences`) in
  addition to localStorage, so it's the same on a fresh browser once
  you're logged in — verified with a clean-profile browser in this repo's
  test pass.

**Phase 3** (LLM Gateway): done.
- `backend/app/llm/` — one adapter interface across Anthropic, Google
  Gemini, and an OpenAI-compatible adapter reused for OpenAI/xAI/DeepSeek/
  a local Ollama (same shape, different `base_url`). A router resolves a
  task type (`chat`, `football_reasoning`, `vision`) to an ordered model
  chain and falls back to the next model on any provider error.
- Settings' "Test" button is a real connectivity check now (a cheap
  models-list call through the same adapter the chat gateway uses, never
  a token-spending completion).
- Chat is fully live: real sessions, real streaming (SSE) through
  `/api/chat/sessions/{id}/messages`, and each assistant reply is tagged
  with which provider/model actually answered.
- **Verified, not assumed**: the Anthropic and Google adapters were
  exercised against their real APIs in this repo's dev pass (with a
  throwaway key — proving request-shape and error-surfacing, not
  fetching real completions), including one full round trip through the
  actual Chat UI in a browser. This sandbox's network policy blocks
  api.openai.com/api.x.ai/api.deepseek.com outright, so the OpenAI-
  compatible adapter (same well-defined SDK shape, confirmed present by
  introspection) could not be verified live here — test it yourself
  against whichever of those you actually use.

**Phase 4** (Football Prediction module): done.
- `backend/app/football/` — the Master Script v3.1 methodology as code:
  a §1E batch-table parser (handles both 8-cell and 6-cell odds
  formats), de-vigged implied probabilities + EV, correct-score cascade
  derivation (§1D), 8-factor confidence scoring → star rating (§7),
  quarter-Kelly stake suggestion with a risk-tier haircut, and the
  agreement/usage/risk-tier flags (§7B).
- A research pass (`POST /api/football/matches/{id}/research`) builds
  the two-source comparison prompt, streams it through the Phase 3 LLM
  gateway, and extracts + validates a strict-JSON response into stored
  `ResearchPrediction`/`ContextRuleFlag` (R1–R6)/`Prediction`/
  `ConfidenceScore`/`RiskFlag` rows.
- `/predict` (Full Match Board) and `/predict/[id]` (Match Detail) are
  fully live: paste-in batch upload and parsing, per-match or
  research-all, manual result entry and grading, and real
  researched/settled/won/lost counts — the mock `data/matches.ts` and
  `lib/predict.ts` are gone.
- **Verified, not assumed**: batch parsing against real markdown input;
  a full research pass against both the Anthropic and Google backends
  through the Phase 3 gateway (mocked-gateway `TestClient` runs plus
  real Playwright browser sessions); manual result recording and
  grading end to end. Five real bugs were found this way and fixed —
  a `risk_tier()` call that forced "high" risk on any cascade with a
  winning margin (confusing "scoreline has a margin" with "this is a
  handicap bet", when `final_tip` is always 1X2), a result-status
  helper that reported "lost" for a result recorded before research
  completed, a result-entry form that couldn't be reached before
  research finished, a missing save-confirmation for that same case,
  and a real hydration-mismatch warning (present since Phase 1/2, not
  new this phase) from `layout.tsx` hardcoding `data-theme="warm"`
  against the pre-hydration theme script — fixed and re-verified at
  zero warnings across 4 pages in a production build.

Still not wired: image/file batch upload (tabs present in the UI, no
backend endpoint yet — text paste is the only real path in), a live
odds/results feed (both fully manual for now), and calibration-log
automation.

**Phase 5** (Bankroll module): done.
- `backend/app/bankroll/` — `current_balance()` derives the bankroll
  purely from the latest `BankrollLedger.balance_after`, never a
  separate mutable counter, so it stays auditable against the entry
  history (docs/MASTER_PLAN.md §6). Placing a bet deducts the stake
  as a ledger entry; settling one as won credits the full return,
  void refunds the stake, and lost records nothing further since the
  stake was already gone at placement.
- A prediction-sourced bet (`POST /api/bankroll/matches/{id}/bet`)
  reuses the Football Prediction module's own Kelly + risk-tier
  stake suggestion and applies the staking rule's `max_stake_pct` as
  the ceiling on top of it, rather than a second independent sizing
  formula — exactly the split §6 calls for. The Football module's
  match detail now sizes its stake suggestion against this real
  balance too; the `DEFAULT_BANKROLL` placeholder constant from
  Phase 4 is gone, and the bootstrapped admin user gets a seeded
  starting deposit of the same figure so real tracking picks up
  where the placeholder left off.
- `/bankroll` is fully live: real balance/ROI/win-rate/open-exposure
  stat tiles, a balance-over-time chart built from actual ledger
  entries, inline bet settlement, manual bet logging, a deposit/
  withdrawal form, and an editable staking-rule card. The old mock's
  Flat/% strategy tabs are gone — the engine only ever implements
  quarter-Kelly, so selectable tabs that didn't change any
  calculation would have been dead UI.
- The Match Detail page's stake card now has a real "Place bet"
  button wired to the new endpoint, showing the logged bet's stake/
  odds/status and guarding against a second bet while one is already
  pending for that match.
- **Verified, not assumed**: a full curl pass over every new endpoint
  (deposits, manual bets, settling won/lost/void, a withdrawal that
  exceeds balance, the duplicate-pending-bet guard, the staking-rule
  ceiling), the bootstrap seed confirmed against a freshly truncated
  database, a clean production build (`tsc --noEmit` and `next
  build`), and a full Playwright pass in that production build:
  logging in, recording a deposit, logging and settling a bet with
  the dashboard math checked by hand, and placing a bet from a
  match's prediction — zero hydration warnings, zero page errors.

Still mock/static: the Model Routing / Usage editing UI in Settings
(routing now reads real data via `/api/routing`, editing it is a
later pass) and the correlation-check math for parlay slips (`Slip`/
`SlipLeg` models exist but no route builds one yet). Both are later
passes per the build order.

**Phase 6** (Integration polish — the build order's phase 7:
"link prediction → bet flow end-to-end, analytics, export"): done.
- Auto-settle: a pending bet placed from a match's own finalized 1X2
  prediction now settles itself — won or lost against `final_tip` —
  the moment that match's result is recorded, instead of needing a
  separate manual settle click. The won/void ledger-crediting logic
  moved into a shared `apply_settlement()` helper so the manual
  settle endpoint and this auto-settle path can't drift apart, and
  it no-ops on an already-settled bet, so re-recording a result
  doesn't double-credit the ledger. Bets on other markets (BTTS,
  Over/Under, ...) still need manual settlement — their outcome
  isn't tied to the one stored `final_tip` field a 1X2 pick's is.
- Analytics: `GET /api/bankroll/dashboard` now returns by-market/
  by-league/by-model P&L and staked breakdowns over decided bets —
  the "breakdown by league/market/model used" dashboard line from
  §6 that hadn't been built yet — rendered as three cards on
  `/bankroll`.
- Export: `GET /api/football/batches/{id}/export.xlsx` builds the
  Full Match Board as a real `.xlsx` via `openpyxl`, from the same
  row data the board API already serves so the sheet can't drift
  from what's on screen — the original Football Prediction MVP
  deliverable (§9) that had shipped without it. An "Export .xlsx"
  link now sits next to Research All on `/predict`.
- **Verified, not assumed**: a curl pass placing bets from two
  seeded predictions and recording results that resolve one won and
  one lost, confirming both auto-settled with no manual call, the
  ledger math checked by hand, and idempotency on a repeated result
  recording (no re-settle, no ledger growth); the exported `.xlsx`
  downloaded and parsed back with `openpyxl` to confirm its rows
  match the board; a clean production build and a full Playwright
  pass with zero hydration warnings and zero page errors. A
  decorator-placement bug (an edit left `@router.get` attached to
  the wrong function) was caught immediately at server startup and
  fixed before this was called done.

Per the build order, what's left is phase 8 (Hardening: key
encryption audit, rate limiting, backups, deployment) and phase 9+
(a future module). The still-mock/not-wired items listed under
Phases 2–5 above haven't changed.

**Phase 8** (Hardening — the build order's phase 8: "key encryption
audit, rate limiting, backups, deployment"): done.
- Rate limiting (`backend/app/core/rate_limit.py`): an in-memory,
  per-IP sliding-window limiter — no Redis needed for a single-process
  personal app. `POST /auth/login` is capped at 10 attempts/5min
  (brute-force protection); chat send and football research are
  capped at 20 calls/min each (catches a retry loop or a stuck client
  before it runs up a real LLM bill).
- Key encryption audit: found that `secret_encryption_key` silently
  derives a usable (but weak, publicly-derivable) key via SHA256 when
  it isn't a real Fernet key — the right fallback for local dev, but a
  real risk if a production deploy forgot to generate one, since the
  placeholder it'd fall back from is sitting in this public repo's
  `.env.example`. Fixed with `assert_production_secrets()`
  (`app/core/config.py`), which refuses to even start — raises at
  import time, before the port binds — if `ENVIRONMENT=production`
  and any of `secret_encryption_key`/`session_secret`/`admin_password`
  is still its exact placeholder value. Also found and fixed: neither
  `backend/` nor `frontend/` had a `.dockerignore`, so the new
  production Dockerfiles' `COPY . .` would have baked `backend/.env`
  (real secrets) straight into an image layer.
- Backups (`scripts/backup_db.sh`, `scripts/restore_db.sh`):
  `pg_dump`/`psql` wrappers that read `DATABASE_URL` from
  `backend/.env` automatically; restore asks for confirmation before
  dropping anything.
- Deployment: production `Dockerfile`s for both services (non-reload,
  non-root, migrations-on-boot for the backend; a multi-stage,
  `output: "standalone"` build for the frontend), `docker-compose.prod.yml`,
  and `docs/DEPLOYMENT.md` covering both open options from the master
  plan (self-host via Docker Compose + a reverse proxy for TLS, or
  Vercel + Railway/Fly.io) plus the secret-generation checklist and a
  manual key-rotation procedure.
- **Verified, not assumed, with one real gap**: the production secrets
  guard was verified directly in all three cases (dev never raises,
  production with a placeholder raises before uvicorn binds a port,
  production with real secrets doesn't raise); rate limiting was
  verified live (11th login attempt in a window returns 429, a
  different simulated IP isn't blocked, the LLM-call limiter fires
  before the route body runs); the backup/restore round trip was
  verified live (a real dump restored into a scratch database with
  matching row counts). The actual Docker image builds could **not**
  be verified — this sandbox's nested environment can't run a Docker
  daemon (no permission to raise ulimits) — so instead each image's
  underlying mechanism was exercised directly outside Docker: the
  entrypoint script was run against the dev database and correctly
  applied migrations before exec'ing the given command, and the
  frontend's standalone build was generated, assembled exactly as the
  Dockerfile does (copying in `public`/`.next/static`), and run
  directly, serving real pages. Build the images yourself
  (`docker compose -f docker-compose.prod.yml build`) before trusting
  them for a real deploy.
