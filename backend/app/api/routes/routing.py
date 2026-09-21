"""Read-only for now — see docs/MASTER_PLAN.md §4. Returns each task's
saved rule if one exists, else the built-in default chain, so Settings
always has something real to show instead of empty state."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.models.llm import ModelRoutingRule
from app.db.models.user import User
from app.db.session import get_db
from app.llm.router import DEFAULT_CHAINS
from app.schemas.routing import RoutingRuleOut

router = APIRouter()


@router.get("/routing", response_model=list[RoutingRuleOut])
def list_routing(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[RoutingRuleOut]:
    saved = {r.task_type: r.model_chain for r in db.scalars(select(ModelRoutingRule).where(ModelRoutingRule.user_id == user.id))}

    out = []
    for task_type, default_chain in DEFAULT_CHAINS.items():
        chain = saved.get(task_type)
        out.append(RoutingRuleOut(task_type=task_type, model_chain=chain or default_chain, is_default=chain is None))
    return out
