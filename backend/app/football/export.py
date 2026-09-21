"""Full Match Board .xlsx export — the original Phase 5 (per
docs/MASTER_PLAN.md §9) deliverable that shipped without it; added in
the Phase 7 integration-polish pass. Takes the same BoardRow shape the
API already serves so the sheet can never drift from what the board
itself shows."""

from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Font

from app.schemas.football import BoardRow

HEADERS = [
    "Kickoff (ICT)", "Home team", "Home country", "Away team", "Away country",
    "Competition country", "Competition", "Odd 1", "Odd X", "Odd 2",
    "App predicted score", "My predicted score", "Stars", "Risk tier",
    "Usage flag", "Result score", "Result status",
]


def build_board_workbook(rows: list[BoardRow]) -> BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = "Full Match Board"
    ws.append(HEADERS)
    for cell in ws[1]:
        cell.font = Font(bold=True)

    for r in rows:
        ws.append([
            r.kickoff_ict.strftime("%d %b, %H:%M"),
            r.home_team, r.home_team_country,
            r.away_team, r.away_team_country,
            r.competition_country, r.competition,
            r.odds_home, r.odds_draw, r.odds_away,
            r.app_predicted_score, r.my_predicted_score or "",
            r.stars, r.risk_tier or "", r.usage_flag or "",
            r.result_score or "", r.result_status,
        ])

    for col in ws.columns:
        max_len = max((len(str(c.value)) for c in col if c.value is not None), default=8)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 32)

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf
