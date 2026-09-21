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
2. **Football Prediction module** — your two-source, EV/star/risk methodology (Master Script v3.1, §5) automated: parse an app/tipster input (text, image, or file), run independent research, compare, score, flag, and produce a ranked Full Match Board with `.xlsx` export.
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

### Theming

Appearance is a real setting, not a fixed look baked into the CSS — this
came out of iterating the mockup through several palettes and wanting to
keep that flexibility for actual use, not just design exploration:

- **Design tokens as CSS custom properties** (`--bg`, `--surface`,
  `--surface-2`, `--border`, `--text`, `--text-2`, `--accent`,
  `--positive`, `--danger`, `--pending`, plus the font stacks), scoped on
  `:root`/`[data-theme]` so every component reads tokens, never hardcoded
  hex — swapping the attribute repaints the whole app.
- **A small set of named presets** shipped with the app (the mockup's
  "Warm Terminal," "Neon Pitch," "Editorial," "Calm Minimal" — see the
  Settings → Appearance card), each just a token set, plus light/dark
  per preset. Adding a new preset is a new token file, not new component
  code.
- **Stored as a user preference** (`user_preferences.theme_preset`,
  `.mode`), applied on load and switchable at runtime from Settings
  without a reload — small enough to skip a dedicated endpoint and just
  ride the same settings-save path as everything else in that screen.
- Custom per-user accent color (beyond the preset list) is a later nice-
  to-have, not v1 — the preset picker covers "change the look" for now.

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

This is the flagship module, and its engine is **your own methodology**
(Master Script v3.1: two-source analysis, EV filtering, context rules,
confidence scoring, risk classification) — the app automates the workflow
you already run by hand in chat. Section 5.1 is the engine as designed;
5.2 is where automating it lets it go further than a manual chat script can.

### 5.1 Engine — kept from Master Script v3.1

**Two sources per match, compared, never blended blindly:**
- `APP_TIP` / `APP_PROB` — extracted from whatever you feed in (screenshot,
  PDF portfolio, text/CSV export). A vision-capable LLM call parses it into
  the fixed schema (§1B of the script): teams, tip, H%/D%/A%, O/U, BTTS,
  correct score, handicap — no manual retyping.
- `MY_RAW_PROB` → `MY_DISC_PROB` — independent research (form, H2H,
  injuries, expert consensus), discounted by a calibration factor
  (starts at the script's 0.87, see 5.2 for how it stops being a fixed
  number).

**Correct-score cascade (§1D):** a predicted correct score is never staked
directly — it's decomposed into BTTS (both scored > 0), total goals
(→ Over/Under 2.5), and margin (→ which Handicap lines, if any, the
scoreline actually supports). A Handicap pick that isn't supported by the
margin is a contradiction, not a bet.

**The 6 context rules (§4), applied before anything is finalized:**
| Rule | Fires when | Action |
|---|---|---|
| R1 Aggregate lead | Team leads 2+ on aggregate | Lean Under/BTTS No for the leader |
| R2 Dead rubber | Either side already eliminated/through | Skip the match entirely |
| R3 Rotation | Dominant team fields a weakened XI | Flip the BTTS lean |
| R4 Prob discount | Always | Apply the calibration factor to `MY_RAW_PROB` |
| R5 Level-tie home win | Aggregate level + strong home form | Prefer the simple home win |
| R6 Consensus | 3+ independent sources agree | Treat that market as data-backed |

**EV and the qualifying filter:** `EV = (MY_DISC_PROB × odd) − 1`. A pick
only reaches "qualifying" output if odd ≥ 1.60, final probability > 50%,
EV > 0%, all context rules clear, and at least one source backs the same
market. **Full Rating Mode is the default** (v3.0): nothing is dropped —
every match gets rated and shown, with a usage flag instead of exclusion
when it would normally fail a gate:
`🔒 BANKER ONLY` (odd < 1.40), `🎲 LOTTERY ODD` (odd > 3.50),
`🎭 FRIENDLY/LOW-STAKES`, `⚠️ CS MISMATCH` (winner agreed, scoreline
contradicts research). Qualifying Mode (the permanent skip list — women's/
youth/reserve leagues, friendlies, <30min to kickoff, odds outside
1.40–3.50) is opt-in only, for a "what do I stake today" view.

**Confidence scoring (§7):** 8 factors (EV size, edge over implied prob,
odd quality, context-rule cleanliness, form, draw risk, injuries, source
agreement), 0–2 points each, 0–16 total → ⭐–⭐⭐⭐⭐⭐, mapped to a
bankroll-% stake tier.

**Risk tier (§7B) — independent of stars:** LOW/MEDIUM/HIGH based on
market type and how fragile the supporting logic is (Handicap and
correct-score-derived picks are HIGH regardless of star count). A HIGH-risk
5-star pick stakes at half its tier's %.

**Disagreement protocol (§6):** when the two sources genuinely conflict,
default is skip — only overridden if research has 3+ source consensus,
no context rule contradicts it, and the odd still clears 1.60; if
overridden, stars are capped at ⭐⭐⭐.

**Slip building:** correlation check before combining legs (no shared
match, no two teams playing again within 48h, max one HIGH-risk leg per
slip), plus a hard daily exposure cap (≤10% of bankroll across everything
staked that day, weakest picks dropped first if over).

**Output:** Top Picks (short format), Best Slips, a Quick Reference table,
and — always, not optional — the **Full Match Board**: every match ranked
by star rating with risk/flag/why, exported as a formatted `.xlsx`
(§8E's exact column spec, dark-blue header, risk color-coding). The app
reproduces this as a real export action, not a manual "build me a
spreadsheet" step each time.

### 5.2 Where automating it goes further than the manual script

The manual version runs as a single chat thread doing ad-hoc web searches.
Turning it into a service is a chance to strengthen the weak points in
that loop, without changing the methodology itself:

1. **Ensemble research instead of one model's read.** Run the independent-
   research step across 2–3 models in parallel (e.g. a strong reasoning
   model + a model with better web/tool grounding) and combine into
   `MY_RAW_PROB` as a confidence-weighted blend rather than one model's
   opinion. Disagreement *between* your own research models becomes an
   extra signal, not just app-vs-research disagreement.
2. **Ground research in structured data, not scraped tipster text.** Pull
   fixtures/form/injuries/lineups from a sports-data API as real inputs to
   the reasoning step, rather than having the LLM summarize tipster
   websites. Keep R6 (consensus), but add real market signal — odds
   movement / closing-line consensus across books — as a stronger
   corroborating signal than "3 tipster sites agree."
3. **Make the mechanical rules deterministic.** R1 (aggregate lead), R2
   (dead rubber), and confirmed-lineup rotation are facts, not judgment
   calls — pull them from data and apply as code so a rule can never be
   silently missed. Reserve the LLM's judgment for genuinely qualitative
   reads (how much a rotation likely affects team shape, how to weigh
   conflicting reports).
4. **Replace the fixed 0.87 discount with a live per-market calibration
   curve.** The script's own v2.2 calibration log (log every settled pick,
   compare predicted vs. actual, adjust) becomes an automated job: track
   Brier score and **closing-line value (CLV)** per market type (1X2 vs.
   BTTS vs. O/U vs. Handicap probably overconfident by different amounts)
   instead of one global multiplier eyeballed every 20 picks.
5. **Merge star-tier staking with real fractional-Kelly sizing.** Compute
   a Kelly-derived base stake from the calibrated probability and odd,
   then apply the risk-tier haircut (5.1) on top — one principled sizing
   path instead of a star-tier lookup table and Kelly living as two
   separate ideas.
6. **Automatic screenshot/PDF parsing.** The vision-LLM extraction in 5.1
   replaces manually retyping App fields from a screenshot — feeds
   straight into the same schema the rest of the pipeline expects.
7. **Live market odds + automatic result capture — this closes the loop.**
   Everything upstream (EV, confidence, the calibration log) is only as
   good as two facts that can't stay manual: the odd actually available at
   stake time, and what actually happened. A sports-data/odds API supplies
   the market odd at parse time (falling back to the uploaded value only
   when the API has no line yet), and the same API polls for the final
   score shortly after full-time — with manual entry as the fallback when
   a fixture isn't covered. A settled result does three things
   automatically: flips the linked `bets` row in the Bankroll module from
   pending to won/lost, appends a row to `calibration_log` (predicted vs.
   actual, feeding the Brier score/CLV in upgrade 4), and updates the
   match's row on the Full Match Board from a predicted score to an
   actual one. Without this, "feedback" stays a spreadsheet you update by
   hand — with it, the star rating and the discount factor are always
   trained on real outcomes.

None of this changes the filters, the rules, or the output format — it
replaces "a person doing steps 3–7 by hand in a chat" with the same steps
run by the backend, with better inputs at each stage.

### 5.3 Data model

- `match_batches` (uploaded sheet/screenshot/PDF, source_ref, parsed_at, mode: `full_rating`|`qualifying`)
- `matches` (batch_id, date_kickoff_ict, competition_country, competition, home_team, home_team_country, away_team, away_team_country, market_odds_1x2, odds_source: `live_api`|`uploaded`, odds_synced_at) — competition country/region (e.g. "Asia (Intl.)") is kept separate from each team's own country, since continental competitions routinely pair teams from different countries (an AFC Champions League Two or Europa League fixture is the common case, not the exception).
- `app_predictions` (match_id, tip, h_pct, d_pct, a_pct, over_under, btts, correct_score, handicap_line, raw_input_ref)
- `research_predictions` (match_id, model_used, raw_prob, disc_prob, correct_score, btts, over_under, handicap_line, rationale, sources: jsonb)
- `context_rule_flags` (match_id, rule_code: R1–R6, fired: bool, note)
- `predictions` (match_id, app_prediction_id, research_prediction_id, final_tip, final_odd, final_prob, ev, agreement: agree/partial/disagree/overridden)
- `confidence_scores` (match_id, factor_breakdown: jsonb, total_points, stars)
- `risk_flags` (match_id, risk_tier: low/medium/high, usage_flag: banker_only/lottery_odd/friendly/cs_mismatch/null)
- `match_results` (match_id, actual_score, actual_outcome: 1/X/2, actual_btts, actual_total_goals, settled_at, result_source: `auto_api`|`manual`) — the fact table that closes the loop: written once by the API poll (or manual entry) shortly after full-time, then read by `bets` (settle pending → won/lost), `calibration_log` (predicted vs. actual), and the Full Match Board (predicted score → actual score).
- `slips` (legs: [match_id], correlation_check: jsonb, combined_odd)
- `calibration_log` (date, market_type, picks_settled, avg_predicted_prob, actual_win_rate, brier_score, clv, discount_factor)
- `daily_exposure` (date, total_pct_staked)

---

## 6. Bankroll module

- `bets` (match_id, prediction_id, market, stake, odds, potential_return, status: pending/won/lost/void, placed_at, settled_at)
- `bankroll_ledger` (transaction_type: deposit/withdrawal/bet_stake/bet_return, amount, balance_after, related_bet_id, timestamp) — append-only, so balance is always derivable/auditable, never just a mutable counter.
- `staking_rules` (strategy: flat / percentage / Kelly, params, active risk limits: max stake per bet, max daily loss stop-loss). For prediction-sourced bets, base size comes from the Football Prediction module's Kelly + risk-tier calculation (§5.1/5.2) rather than a second independent formula here — this module enforces the ceiling (daily exposure cap, per-bet max) on top of whatever suggested it.
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
| 5 | Football Prediction MVP: implement the Master Script v3.1 engine (§5) end to end — App-input parsing, research + context rules + EV, confidence/risk scoring, Full Match Board with `.xlsx` export |
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
