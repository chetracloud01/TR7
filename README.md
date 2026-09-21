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
