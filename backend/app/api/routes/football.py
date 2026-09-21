"""Football Prediction module — docs/MASTER_PLAN.md §5. Parsing is
deterministic (app/football/parser.py); research is a real LLM call
through the Phase 3 gateway (app/football/engine.py) — not grounded in
live stats/odds feeds yet, so treat rationale/rules as the model's own
read, not verified research (see that module's docstring)."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.bankroll.service import current_balance
from app.core.deps import get_current_user
from app.db.models.football import (
    AppPrediction,
    ConfidenceScore,
    ContextRuleFlag,
    Match,
    MatchBatch,
    MatchResult,
    Prediction,
    ResearchPrediction,
    RiskFlag,
)
from app.db.models.user import User
from app.db.session import get_db
from app.football import flags
from app.football.cascade import derive_cascade, winner
from app.football.confidence import FACTOR_LABELS, compute_confidence
from app.football.engine import ResearchError, run_research
from app.football.odds import ev, implied_probabilities
from app.football.parser import parse_batch_text, parse_kickoff
from app.football.staking import suggested_stake
from app.schemas.football import (
    BatchCreate,
    BatchOut,
    BatchSummary,
    BoardRow,
    CascadeOut,
    ConfidenceFactorOut,
    ConfidenceOut,
    MatchDetailOut,
    ParseWarning,
    ResultOut,
    ResultUpdate,
    RuleOut,
    StakeOut,
)

router = APIRouter()

RULE_LABELS = {
    "R1": "Aggregate lead",
    "R2": "Dead rubber",
    "R3": "Rotation",
    "R4": "Prob. discount",
    "R5": "Level-tie home win",
    "R6": "Consensus",
}


def _get_owned_match(match_id: int, user: User, db: Session) -> Match:
    match = db.get(Match, match_id)
    if match is None or match.batch.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    return match


def _get_owned_batch(batch_id: int, user: User, db: Session) -> MatchBatch:
    batch = db.get(MatchBatch, batch_id)
    if batch is None or batch.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    return batch


def _result_status(pred: Prediction | None, result: MatchResult | None) -> str:
    """"pending" until both a finalized prediction (needs research) and a
    recorded result exist — a result recorded before research completes
    is not a loss, it's just nothing to grade yet."""
    if result is None or pred is None or pred.final_tip is None:
        return "pending"
    return "won" if result.actual_outcome == pred.final_tip else "lost"


def _to_board_row(match: Match) -> BoardRow:
    app_pred = match.app_prediction
    pred = match.prediction
    conf = match.confidence_score
    risk = match.risk_flag
    result = match.result

    return BoardRow(
        id=match.id,
        kickoff_ict=match.date_kickoff_ict,
        home_team=match.home_team,
        home_team_country=match.home_team_country,
        away_team=match.away_team,
        away_team_country=match.away_team_country,
        competition_country=match.competition_country,
        competition=match.competition,
        odds_home=match.odds_home,
        odds_draw=match.odds_draw,
        odds_away=match.odds_away,
        app_predicted_score=app_pred.correct_score if app_pred else "",
        researched=pred is not None,
        my_predicted_score=match.research_predictions[-1].correct_score if match.research_predictions else None,
        stars=conf.stars if conf else None,
        risk_tier=risk.risk_tier if risk else None,
        usage_flag=risk.usage_flag if risk else None,
        result_status=_result_status(pred, result),
        result_score=result.actual_score if result else None,
    )


@router.get("/football/batches", response_model=list[BatchSummary])
def list_batches(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[BatchSummary]:
    batches = db.scalars(select(MatchBatch).where(MatchBatch.user_id == user.id).order_by(MatchBatch.id.desc())).all()
    return [BatchSummary(id=b.id, created_at=b.created_at, match_count=len(b.matches)) for b in batches]


@router.post("/football/batches", response_model=BatchOut)
def create_batch(payload: BatchCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BatchOut:
    parsed = parse_batch_text(payload.text)
    if not parsed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No matches found — check the table format (§1E).")

    batch = MatchBatch(user_id=user.id, mode="full_rating")
    db.add(batch)
    db.flush()

    now = datetime.now(UTC).replace(tzinfo=None)
    warnings: list[ParseWarning] = []

    for pm in parsed:
        if pm.odds_home is None or pm.odds_draw is None or pm.odds_away is None or not pm.predicted_score:
            warnings.append(ParseWarning(raw_row=f"{pm.home_team} vs {pm.away_team}", errors=pm.errors))
            continue

        kickoff = parse_kickoff(pm.kickoff_raw, now) or now
        match = Match(
            batch_id=batch.id,
            date_kickoff_ict=kickoff,
            competition_country=pm.competition_country,
            competition=pm.competition,
            home_team=pm.home_team,
            home_team_country="",
            away_team=pm.away_team,
            away_team_country="",
            odds_home=pm.odds_home,
            odds_draw=pm.odds_draw,
            odds_away=pm.odds_away,
            odds_source="uploaded",
        )
        db.add(match)
        db.flush()
        db.add(AppPrediction(match_id=match.id, correct_score=pm.predicted_score))
        if pm.errors:
            warnings.append(ParseWarning(raw_row=f"{pm.home_team} vs {pm.away_team}", errors=pm.errors))

    db.commit()
    db.refresh(batch)

    return BatchOut(id=batch.id, created_at=batch.created_at, matches=[_to_board_row(m) for m in batch.matches], parse_warnings=warnings)


@router.get("/football/batches/{batch_id}", response_model=BatchOut)
def get_batch(batch_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BatchOut:
    batch = _get_owned_batch(batch_id, user, db)
    return BatchOut(id=batch.id, created_at=batch.created_at, matches=[_to_board_row(m) for m in batch.matches])


def _to_detail(match: Match, user_id: int, db: Session) -> MatchDetailOut:
    app_pred = match.app_prediction
    app_score = app_pred.correct_score if app_pred else ""
    implied_home, implied_draw, implied_away = implied_probabilities(match.odds_home, match.odds_draw, match.odds_away)
    implied_by_side = {"1": implied_home, "X": implied_draw, "2": implied_away}
    odd_by_side = {"1": match.odds_home, "X": match.odds_draw, "2": match.odds_away}

    app_side = winner(app_score) if app_score else "1"
    app_implied_prob = implied_by_side[app_side]
    app_ev = ev(app_implied_prob, odd_by_side[app_side])

    pred = match.prediction
    conf = match.confidence_score
    risk = match.risk_flag
    result = match.result
    research = match.research_predictions[-1] if match.research_predictions else None
    rule_flags = {f.rule_code: f for f in match.rule_flags}

    detail = MatchDetailOut(
        id=match.id,
        home_team=match.home_team,
        home_team_country=match.home_team_country,
        away_team=match.away_team,
        away_team_country=match.away_team_country,
        competition=match.competition,
        competition_country=match.competition_country,
        kickoff_ict=match.date_kickoff_ict,
        odds_home=match.odds_home,
        odds_draw=match.odds_draw,
        odds_away=match.odds_away,
        app_predicted_score=app_score,
        app_implied_prob_pct=app_implied_prob,
        app_ev=app_ev,
        researched=pred is not None,
        result=ResultOut(
            status=_result_status(pred, result),
            score=result.actual_score if result else None,
            settled_at=result.settled_at if result else None,
        ),
    )

    if research:
        detail.my_predicted_score = research.correct_score
        detail.my_raw_prob_pct = research.raw_prob
        detail.my_disc_prob_pct = research.disc_prob
        detail.rationale = research.rationale
        detail.model_used = research.model_used

    if pred:
        detail.my_ev = pred.ev
        detail.agreement = pred.agreement
        detail.final_tip = pred.final_tip
        detail.final_odd = pred.final_odd
        detail.final_prob = pred.final_prob

    cascade = derive_cascade(research.correct_score) if research else None
    if cascade:
        detail.cascade = CascadeOut(margin=cascade.margin, btts=cascade.btts, over_under=cascade.over_under, handicap_note=cascade.handicap_note)

    if research:
        detail.rules = [
            RuleOut(code=code, label=RULE_LABELS[code], fired=rule_flags[code].fired if code in rule_flags else False, note=rule_flags[code].note or "" if code in rule_flags else "")
            for code in ["R1", "R2", "R3", "R4", "R5", "R6"]
        ]

    if conf:
        detail.confidence = ConfidenceOut(
            factors=[ConfidenceFactorOut(label=label, points=pt) for label, pt in zip(FACTOR_LABELS, conf.factor_breakdown.get("points", []))],
            total=conf.total_points,
            stars=conf.stars,
        )

    if risk:
        detail.risk_tier = risk.risk_tier
        detail.usage_flag = risk.usage_flag
        if pred and pred.final_prob is not None and pred.final_odd is not None:
            balance = current_balance(db, user_id)
            stake = suggested_stake(pred.final_prob, pred.final_odd, risk.risk_tier, balance)
            detail.stake = StakeOut(pct=stake.pct, amount=stake.amount)

    return detail


@router.get("/football/matches/{match_id}", response_model=MatchDetailOut)
def get_match(match_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MatchDetailOut:
    match = _get_owned_match(match_id, user, db)
    return _to_detail(match, user.id, db)


@router.post("/football/matches/{match_id}/research", response_model=MatchDetailOut)
async def research_match(match_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MatchDetailOut:
    match = _get_owned_match(match_id, user, db)
    app_pred = match.app_prediction
    if app_pred is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No parsed prediction for this match.")

    try:
        result = await run_research(
            db, user.id,
            home_team=match.home_team, away_team=match.away_team, competition=match.competition,
            competition_country=match.competition_country, kickoff_raw=match.date_kickoff_ict.strftime("%d %b, %H:%M"),
            odds_home=match.odds_home, odds_draw=match.odds_draw, odds_away=match.odds_away,
            app_predicted_score=app_pred.correct_score,
        )
    except ResearchError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e)) from e

    if result.home_team_country and not match.home_team_country:
        match.home_team_country = result.home_team_country
    if result.away_team_country and not match.away_team_country:
        match.away_team_country = result.away_team_country

    db.add(
        ResearchPrediction(
            match_id=match.id, model_used=f"{result.provider}:{result.model}", raw_prob=result.raw_prob_pct,
            disc_prob=round(result.raw_prob_pct * 0.87, 1), correct_score=result.correct_score,
            btts=result.btts, over_under=result.over_under, handicap_line=result.handicap_line,
            rationale=result.rationale, sources=[],
        )
    )

    for code in ["R1", "R2", "R3", "R5", "R6"]:
        key = {"R1": "R1_aggregate_lead", "R2": "R2_dead_rubber", "R3": "R3_rotation", "R5": "R5_level_tie_home_win", "R6": "R6_consensus"}[code]
        rule_data = result.rules.get(key, {})
        existing = db.scalar(select(ContextRuleFlag).where(ContextRuleFlag.match_id == match.id, ContextRuleFlag.rule_code == code))
        if existing is None:
            existing = ContextRuleFlag(match_id=match.id, rule_code=code)
            db.add(existing)
        existing.fired = bool(rule_data.get("fired", False))
        existing.note = str(rule_data.get("note", ""))
    # R4 (the calibration discount) is always applied, never LLM-judged.
    r4 = db.scalar(select(ContextRuleFlag).where(ContextRuleFlag.match_id == match.id, ContextRuleFlag.rule_code == "R4"))
    if r4 is None:
        r4 = ContextRuleFlag(match_id=match.id, rule_code="R4")
        db.add(r4)
    r4.fired = False
    r4.note = "0.87 discount applied"

    implied_home, implied_draw, implied_away = implied_probabilities(match.odds_home, match.odds_draw, match.odds_away)
    implied_by_side = {"1": implied_home, "X": implied_draw, "2": implied_away}
    odd_by_side = {"1": match.odds_home, "X": match.odds_draw, "2": match.odds_away}

    my_disc_prob = round(result.raw_prob_pct * 0.87, 1)
    my_side = winner(result.correct_score)
    my_odd = odd_by_side[my_side]
    my_ev = ev(my_disc_prob, my_odd)

    app_side = winner(app_pred.correct_score)
    app_implied_prob = implied_by_side[app_side]

    agr = flags.agreement(app_pred.correct_score, result.correct_score)
    final_prob = max(app_implied_prob, my_disc_prob)
    final_tip = my_side if my_disc_prob >= app_implied_prob else app_side

    pred = db.scalar(select(Prediction).where(Prediction.match_id == match.id))
    if pred is None:
        pred = Prediction(match_id=match.id)
        db.add(pred)
    pred.final_tip = final_tip
    pred.final_odd = odd_by_side[final_tip]
    pred.final_prob = final_prob
    pred.ev = my_ev
    pred.agreement = agr

    rules_fired_count = sum(
        1 for key in ["R1_aggregate_lead", "R2_dead_rubber", "R3_rotation"] if result.rules.get(key, {}).get("fired")
    )

    conf_breakdown = compute_confidence(
        ev_value=my_ev, my_prob_pct=my_disc_prob, implied_prob_pct=app_implied_prob, odd=my_odd,
        implied_draw_pct=implied_draw, rules_fired_count=rules_fired_count,
        form=result.factors["form"], injuries=result.factors["injuries"], source_agreement=result.factors["source_agreement"],
    )
    conf = db.scalar(select(ConfidenceScore).where(ConfidenceScore.match_id == match.id))
    if conf is None:
        conf = ConfidenceScore(match_id=match.id)
        db.add(conf)
    conf.factor_breakdown = {"points": conf_breakdown.points}
    conf.total_points = conf_breakdown.total
    conf.stars = conf_breakdown.stars

    tier = flags.risk_tier(agreement_result=agr, rules_fired_count=rules_fired_count, implied_draw_pct=implied_draw, odd=my_odd)
    usage = flags.usage_flag(my_odd, match.competition)

    risk = db.scalar(select(RiskFlag).where(RiskFlag.match_id == match.id))
    if risk is None:
        risk = RiskFlag(match_id=match.id)
        db.add(risk)
    risk.risk_tier = tier
    risk.usage_flag = usage

    db.commit()
    db.refresh(match)
    return _to_detail(match, user.id, db)


@router.post("/football/matches/{match_id}/result", response_model=MatchDetailOut)
def record_result(match_id: int, payload: ResultUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MatchDetailOut:
    match = _get_owned_match(match_id, user, db)
    outcome = winner(payload.actual_score)

    result = db.scalar(select(MatchResult).where(MatchResult.match_id == match.id))
    if result is None:
        result = MatchResult(match_id=match.id)
        db.add(result)
    result.actual_score = payload.actual_score
    result.actual_outcome = outcome
    parts = payload.actual_score.replace("–", "-").split("-")
    home, away = int(parts[0].strip()), int(parts[1].strip())
    result.actual_btts = home > 0 and away > 0
    result.actual_total_goals = home + away
    result.settled_at = datetime.now(UTC).replace(tzinfo=None)
    result.result_source = "manual"

    db.commit()
    db.refresh(match)
    return _to_detail(match, user.id, db)
