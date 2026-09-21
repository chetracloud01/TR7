# TR7 — Master Plan

Personal web app: a multi-LLM hub with live chat, plus a football prediction
module that compares an in-house prediction against predictions sourced from
elsewhere (text / image / file), feeding a bankroll-controlled betting
record system. Built module-by-module so more modules (other sports, other
tools) can be bolted on later without a rewrite.

This plan covers backend + frontend architecture and the build order. It
assumes: you build the UX/UI mockup first (Figma or similar), then this plan
drives implementation.

---

## 1. Scope for v1

In scope now:
1. **LLM Hub** — connect multiple LLM providers with your own API keys, pick/route models, live streaming chat.
2. **Football Prediction module** — generate an internal prediction; ingest an external prediction from text, image, or file upload; compare the two; surface a recommendation.
3. **Bankroll module** — betting ledger, staking rules, P&L/ROI tracking, risk limits.

Explicitly deferred (but the architecture below leaves room for them):
other sports, other "modules," multi-user/public access, mobile app.

---

## 2. High-level architecture

```
┌─────────────────────────────┐
│   Frontend (Next.js/React)  │
│  - Chat UI (streaming)      │
│  - Prediction module UI     │
│  - Bankroll dashboard       │
└──────────────┬──────────────┘
               │ REST/GraphQL + SSE/WebSocket
┌──────────────┴──────────────┐
│   Backend API (FastAPI)     │
│  ┌────────────────────────┐ │
│  │  LLM Gateway            │ │  ← unified interface over all providers,
│  │  (provider adapters,    │ │     model router, streaming, usage/cost log
│  │   key vault, router)    │ │
│  └────────────────────────┘ │
│  ┌────────────────────────┐ │
│  │  Football Prediction    │ │  ← internal predictor + external-input
│  │  module                 │ │     ingestion (vision LLM parses image/file)
│  │  (compare + confidence) │ │     + comparison engine
│  └────────────────────────┘ │
│  ┌────────────────────────┐ │
│  │  Bankroll module         │ │  ← bet ledger, staking calculator,
│  │  (ledger, staking rules) │ │     risk limits, analytics
│  └────────────────────────┘ │
│  ┌────────────────────────┐ │
│  │  Chat module             │ │  ← sessions, message history, per-module
│  │  (sessions, history)     │ │     system prompts
│  └────────────────────────┘ │
└──────────────┬──────────────┘
               │
┌──────────────┴──────────────┐
│  PostgreSQL (single DB)     │
│  - users, provider keys     │
│  - chat sessions/messages   │
│  - matches, predictions     │
│  - bets, bankroll_ledger    │
└──────────────────────────────┘
```

Why this split: the LLM Gateway, Prediction module, and Bankroll module are
independent services sharing one DB and one API surface — each is a
"plugin" so a future module (e.g. a new sport) is a new directory, not a
rewrite of the router or the chat layer.

---

## 3. Tech stack (recommendation)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui | Fast to turn a mockup into real components; built-in streaming support for chat UI. |
| Backend | FastAPI (Python) | Football prediction/stats work benefits from Python's data/ML ecosystem (pandas, numpy, scikit-learn); async-friendly for streaming LLM calls. |
| LLM abstraction | LiteLLM (or a thin custom adapter layer) | One call signature across OpenAI, Anthropic, Google, xAI, DeepSeek, local/Ollama models — swap/add providers without touching call sites. |
| Database | PostgreSQL | Relational data (ledger, bets, predictions) needs integrity/joins; use Supabase or self-hosted + Docker. |
| ORM/migrations | SQLAlchemy + Alembic | Standard, explicit migrations for a money-tracking schema. |
| Realtime | Server-Sent Events for chat token streaming; WebSocket only if you later want live odds pushes | SSE is simpler and sufficient for streaming text. |
| Auth | Lightweight session auth (even for personal use) — e.g. NextAuth with a single allowed account, or a simple signed-cookie login | You're storing API keys and financial records; don't leave the app unauthenticated even if only you use it. |
| Secrets | Provider API keys encrypted at rest (app-level AES, key from env var/secret manager) | Never store keys in plaintext even in your own DB. |
| Deployment | Docker Compose (Postgres + backend + frontend) for self-host, or Vercel (frontend) + Railway/Fly.io (backend+DB) | Personal-scale, low ops burden either way. |

---

## 4. LLM Gateway design

- **Provider registry**: table of providers (Anthropic, OpenAI, Google, xAI, DeepSeek, etc.), each with your API key (encrypted), enabled flag, and per-model capability tags (`chat`, `vision`, `reasoning`, `cheap`, `fast`).
- **Model router**: given a task type, pick the best-fit model:
  - Vision/document parsing (reading a screenshot of someone else's prediction) → a vision-capable model.
  - Football reasoning/prediction → your strongest reasoning model.
  - Everyday chat → a cheaper/faster model, with the stronger model available on demand.
  - Config-driven (a small YAML/DB table mapping task → ordered model preference list + fallback chain), not hardcoded, so you can re-rank without code changes.
- **Streaming**: one internal `stream_completion(messages, task_type)` function; adapters normalize each provider's stream format to a common token event.
- **Usage/cost logging**: every call logged (provider, model, tokens, cost estimate, latency) — useful both for the "best fit" decision over time and to watch spend.
- **Failure handling**: if a provider errors/rate-limits, fall back to the next model in that task's preference list; surface which model actually answered in the UI (transparency matters when you're comparing predictions).

---

## 5. Football Prediction module

**Inputs:**
1. Internal prediction — generated by your own pipeline (start simple: an LLM-reasoning prediction grounded in fixture/team stats you feed it; can evolve into a statistical model (Poisson/Elo) later feeding the LLM as context rather than replacing it).
2. External prediction — supplied by you as text, an image (screenshot), or a file (PDF/CSV). A vision-capable LLM call extracts structured data from image/file input (teams, market, predicted outcome, odds, confidence/tipster notes) into a common schema — this avoids building a bespoke OCR pipeline.

**Comparison engine:**
- Normalizes both predictions into the same shape: `{match, market, predicted_outcome, probability/confidence, source}`.
- Produces a side-by-side comparison + a delta/agreement score.
- Feeds a recommendation (agree/disagree, confidence-weighted) — this is what later informs a bet suggestion, not an automatic bet.

**Data model (sketch):**
- `matches` (fixture, teams, league, kickoff time)
- `predictions` (match_id, source: `internal`|`external`, model_used, market, predicted_outcome, probability, confidence, raw_input_ref, created_at)
- `prediction_comparisons` (match_id, internal_prediction_id, external_prediction_id, agreement_score, notes)

---

## 6. Bankroll module

- `bets` (match_id, prediction_id, market, stake, odds, potential_return, status: pending/won/lost/void, placed_at, settled_at)
- `bankroll_ledger` (transaction_type: deposit/withdrawal/bet_stake/bet_return, amount, balance_after, related_bet_id, timestamp) — append-only, so balance is always derivable/auditable, never just a mutable counter.
- `staking_rules` (strategy: flat / percentage / Kelly, params, active risk limits: max stake per bet, max daily loss stop-loss).
- Dashboard: current bankroll, ROI/yield, win rate, breakdown by league/market/model used — this is where the prediction module and bankroll module connect (a bet is optionally linked back to the prediction/comparison that triggered it).

---

## 7. Chat module

- `chat_sessions`, `chat_messages` (session_id, role, content, model_used, created_at).
- Model picker in the UI (or "auto" = let the router pick).
- Optional per-module system prompts (e.g. a "football analyst" persona pre-loaded when chatting from inside the prediction module).

---

## 8. Suggested repo structure

```
/frontend                  Next.js app
  /app
    /chat
    /predict-football
    /bankroll
  /components
/backend
  /app
    /api                   route handlers
    /core                  config, security, encryption
    /llm                   provider adapters + router
    /modules
      /football_prediction
      /bankroll
      /chat
    /db                    SQLAlchemy models + Alembic migrations
/infra                     docker-compose, deploy configs
/docs                      this file, future ADRs
```

---

## 9. Build order (after your mockup is done)

| Phase | Deliverable |
|---|---|
| 0 | UX/UI mockup (you) — screens for chat, prediction compare view, bet slip, bankroll dashboard |
| 1 | Repo scaffolding: Next.js + FastAPI skeletons, Postgres via Docker Compose, Alembic baseline migration, CI lint/test |
| 2 | Auth + settings screen: login, provider key vault (add/edit/test a key per provider) |
| 3 | LLM Gateway: adapters for your chosen providers, model router config, streaming endpoint |
| 4 | Chat module: sessions, history, model picker, streaming UI wired to mockup |
| 5 | Football Prediction MVP: internal prediction generation, external input ingestion (text first, then image/file via vision model), comparison view |
| 6 | Bankroll module: ledger, bet entry (manual + "place from prediction"), staking calculator, dashboard |
| 7 | Integration polish: link prediction → bet flow end-to-end, analytics, export |
| 8 | Hardening: key encryption audit, rate limiting, backups, deployment |
| 9+ | Next module (future sport/tool), reusing the same plugin structure |

---

## 10. Open decisions (yours to make, not blocking the plan)

- Which LLM providers to start with (affects which adapters get built first).
- Data source for fixtures/odds (a paid sports-data API vs. manual entry vs. LLM web lookup).
- Self-host (Docker on your own box) vs. cloud (Vercel + Railway/Fly.io) for deployment.
- How much of the "internal prediction" should be a real statistical model vs. LLM reasoning over stats you supply — can start LLM-only and evolve.

---

Next step once you're ready: share the mockup, and Phase 1 (repo scaffolding) can start against the actual screens instead of placeholders.
