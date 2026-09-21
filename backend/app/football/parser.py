"""Parses the batch input format from Master Script v3.1 §1E — a plain
markdown table, no LLM needed (a fixed table format is exactly the case
where a deterministic parser beats an LLM call: faster, free, and never
misreads a number).

Expected shape (the "Market Odds (1X2)" header names one column but the
row carries three cells for it — home/draw/away — matching how the
script's own example is written):

| Date & Kickoff (ICT) | Country | League / Competition | Match | Predicted Score | Market Odds (1X2) |
| --- | --- | --- | --- | --- | --- |
| 17 Sep, 17:00 | Asia (Intl.) | AFC Champions League Two | Adelaide United vs Tai Po | 3 – 1 | 1.36 | 4.75 | 7.50 |

Team country isn't in this template (only the competition's) — left
blank here and filled in by the research engine, which is reasonably
good at knowing a club's home country from its name.
"""

import re
from dataclasses import dataclass, field
from datetime import datetime

_SEPARATOR_ROW = re.compile(r"^[\s|:\-]+$")
_DASH_BETWEEN_DIGITS = re.compile(r"(\d)\s*[-–—]\s*(\d)")


@dataclass
class ParsedMatch:
    kickoff_raw: str
    competition_country: str
    competition: str
    home_team: str
    away_team: str
    predicted_score: str
    odds_home: float | None
    odds_draw: float | None
    odds_away: float | None
    errors: list[str] = field(default_factory=list)


def _clean_cell(cell: str) -> str:
    return cell.strip().strip("*").strip()


def _split_row(line: str) -> list[str]:
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [_clean_cell(c) for c in stripped.split("|")]


def _parse_float(raw: str) -> float | None:
    try:
        return float(raw.replace(",", "."))
    except ValueError:
        return None


def _parse_odds(cells: list[str]) -> tuple[float | None, float | None, float | None]:
    if len(cells) >= 3:
        return _parse_float(cells[0]), _parse_float(cells[1]), _parse_float(cells[2])
    if len(cells) == 1:
        parts = re.split(r"[/,|]|\s{2,}", cells[0])
        parts = [p.strip() for p in parts if p.strip()]
        if len(parts) >= 3:
            return _parse_float(parts[0]), _parse_float(parts[1]), _parse_float(parts[2])
    return None, None, None


_KICKOFF_RE = re.compile(r"(\d{1,2})\s+([A-Za-z]{3,})\D*?(\d{1,2}):(\d{2})")


def parse_kickoff(raw: str, reference: datetime) -> datetime | None:
    """"17 Sep, 17:00" -> a real datetime. No year in the input, so this
    assumes `reference`'s year, rolling forward a year if that would put
    the match more than a week in the past (handles a batch pasted right
    around New Year's)."""
    m = _KICKOFF_RE.search(raw)
    if not m:
        return None
    day, month_name, hour, minute = m.groups()
    try:
        month = datetime.strptime(month_name[:3], "%b").month
    except ValueError:
        return None

    try:
        candidate = reference.replace(
            year=reference.year, month=month, day=int(day), hour=int(hour), minute=int(minute), second=0, microsecond=0
        )
    except ValueError:
        return None

    if (reference - candidate).days > 7:
        candidate = candidate.replace(year=reference.year + 1)
    return candidate


def parse_batch_text(text: str) -> list[ParsedMatch]:
    matches: list[ParsedMatch] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line.startswith("|"):
            continue
        if _SEPARATOR_ROW.match(line):
            continue

        cells = _split_row(line)
        if not cells or cells[0].lower().startswith("date"):
            continue  # header row

        if len(cells) < 5:
            continue  # too short to be a real data row

        kickoff_raw, country, competition, teams, score, *odds_cells = cells
        errors: list[str] = []

        team_split = re.split(r"\s+vs\.?\s+", teams, maxsplit=1, flags=re.IGNORECASE)
        if len(team_split) != 2:
            errors.append(f'Could not split "{teams}" into home/away teams.')
            home_team, away_team = teams, ""
        else:
            home_team, away_team = team_split[0].strip(), team_split[1].strip()

        score_normalized = _DASH_BETWEEN_DIGITS.sub(r"\1–\2", score) if score else score
        if score and not _DASH_BETWEEN_DIGITS.search(score):
            errors.append(f'Predicted score "{score}" doesn\'t look like "X – Y".')

        odds_home, odds_draw, odds_away = _parse_odds(odds_cells)
        if odds_home is None or odds_draw is None or odds_away is None:
            errors.append("Couldn't parse all three 1X2 odds.")

        matches.append(
            ParsedMatch(
                kickoff_raw=kickoff_raw,
                competition_country=country,
                competition=competition,
                home_team=home_team,
                away_team=away_team,
                predicted_score=score_normalized,
                odds_home=odds_home,
                odds_draw=odds_draw,
                odds_away=odds_away,
                errors=errors,
            )
        )

    return matches
