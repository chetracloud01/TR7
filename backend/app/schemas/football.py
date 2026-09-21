from datetime import datetime

from pydantic import BaseModel


class BatchCreate(BaseModel):
    text: str


class ParseWarning(BaseModel):
    raw_row: str
    errors: list[str]


class BoardRow(BaseModel):
    id: int
    kickoff_ict: datetime
    home_team: str
    home_team_country: str
    away_team: str
    away_team_country: str
    competition_country: str
    competition: str
    odds_home: float
    odds_draw: float
    odds_away: float
    app_predicted_score: str
    researched: bool
    my_predicted_score: str | None = None
    stars: int | None = None
    risk_tier: str | None = None
    usage_flag: str | None = None
    result_status: str = "pending"  # pending | won | lost
    result_score: str | None = None

    model_config = {"from_attributes": True}


class BatchOut(BaseModel):
    id: int
    created_at: datetime
    matches: list[BoardRow]
    parse_warnings: list[ParseWarning] = []


class BatchSummary(BaseModel):
    id: int
    created_at: datetime
    match_count: int

    model_config = {"from_attributes": True}


class RuleOut(BaseModel):
    code: str
    label: str
    fired: bool
    note: str


class ConfidenceFactorOut(BaseModel):
    label: str
    points: int


class ConfidenceOut(BaseModel):
    factors: list[ConfidenceFactorOut]
    total: int
    stars: int


class CascadeOut(BaseModel):
    margin: int
    btts: bool
    over_under: str
    handicap_note: str


class StakeOut(BaseModel):
    pct: float
    amount: float


class ResultOut(BaseModel):
    status: str  # pending | won | lost
    score: str | None
    settled_at: datetime | None


class MatchDetailOut(BaseModel):
    id: int
    home_team: str
    home_team_country: str
    away_team: str
    away_team_country: str
    competition: str
    competition_country: str
    kickoff_ict: datetime
    odds_home: float
    odds_draw: float
    odds_away: float
    app_predicted_score: str
    app_implied_prob_pct: float
    app_ev: float

    researched: bool
    my_predicted_score: str | None = None
    my_raw_prob_pct: float | None = None
    my_disc_prob_pct: float | None = None
    my_ev: float | None = None
    rationale: str | None = None
    model_used: str | None = None

    agreement: str | None = None
    final_tip: str | None = None
    final_odd: float | None = None
    final_prob: float | None = None

    cascade: CascadeOut | None = None
    rules: list[RuleOut] = []
    confidence: ConfidenceOut | None = None
    risk_tier: str | None = None
    usage_flag: str | None = None
    stake: StakeOut | None = None

    result: ResultOut


class ResultUpdate(BaseModel):
    actual_score: str
