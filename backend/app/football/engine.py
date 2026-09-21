"""Runs one match through the research LLM call and turns its JSON
output into a validated, typed result — the only place that has to deal
with "the model didn't return quite what was asked for"."""

import json
import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.football.prompts import SYSTEM_PROMPT, build_user_prompt
from app.llm.router import stream_with_fallback

_CODE_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class ResearchError(Exception):
    pass


@dataclass
class ResearchResult:
    correct_score: str
    raw_prob_pct: float
    btts: bool
    over_under: str
    handicap_line: str | None
    rationale: str
    home_team_country: str
    away_team_country: str
    rules: dict[str, dict]
    factors: dict[str, int]
    provider: str
    model: str


def _extract_json(text: str) -> dict:
    stripped = _CODE_FENCE.sub("", text.strip()).strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    start, end = stripped.find("{"), stripped.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(stripped[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise ResearchError(f"Model didn't return valid JSON: {stripped[:200]}")


_REQUIRED_FIELDS = ["correct_score", "raw_prob_pct", "btts", "over_under", "rationale", "rules", "factors"]


def _validate(data: dict) -> None:
    missing = [f for f in _REQUIRED_FIELDS if f not in data]
    if missing:
        raise ResearchError(f"Model's JSON is missing fields: {', '.join(missing)}")


async def run_research(
    db: Session, user_id: int, *, home_team: str, away_team: str, competition: str, competition_country: str,
    kickoff_raw: str, odds_home: float, odds_draw: float, odds_away: float, app_predicted_score: str,
) -> ResearchResult:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": build_user_prompt(
                home_team=home_team, away_team=away_team, competition=competition,
                competition_country=competition_country, kickoff_raw=kickoff_raw,
                odds_home=odds_home, odds_draw=odds_draw, odds_away=odds_away,
                app_predicted_score=app_predicted_score,
            ),
        },
    ]

    full_text = ""
    provider = model = ""
    async for event in stream_with_fallback(db, user_id, "football_reasoning", messages):
        if event["type"] == "token":
            full_text += event["text"]
        elif event["type"] == "done":
            provider, model = event["provider"], event["model"]
        elif event["type"] == "error":
            raise ResearchError(event["message"])

    data = _extract_json(full_text)
    _validate(data)

    factors = data.get("factors", {})
    return ResearchResult(
        correct_score=str(data["correct_score"]),
        raw_prob_pct=float(data["raw_prob_pct"]),
        btts=bool(data["btts"]),
        over_under=str(data["over_under"]).upper(),
        handicap_line=data.get("handicap_line"),
        rationale=str(data["rationale"]),
        home_team_country=str(data.get("home_team_country") or ""),
        away_team_country=str(data.get("away_team_country") or ""),
        rules=data.get("rules", {}),
        factors={"form": int(factors.get("form", 0)), "injuries": int(factors.get("injuries", 0)), "source_agreement": int(factors.get("source_agreement", 0))},
        provider=provider,
        model=model,
    )
