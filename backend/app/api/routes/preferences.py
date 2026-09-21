from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.models.user import User, UserPreference
from app.db.session import get_db
from app.schemas.preferences import PreferencesOut, PreferencesUpdate

router = APIRouter()


def _get_or_create(user: User, db: Session) -> UserPreference:
    if user.preference is None:
        db.add(UserPreference(user_id=user.id))
        db.commit()
        db.refresh(user)
    return user.preference


@router.get("/preferences", response_model=PreferencesOut)
def get_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserPreference:
    return _get_or_create(user, db)


@router.put("/preferences", response_model=PreferencesOut)
def update_preferences(
    payload: PreferencesUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> UserPreference:
    pref = _get_or_create(user, db)
    if payload.theme_preset is not None:
        pref.theme_preset = payload.theme_preset
    if payload.mode is not None:
        pref.mode = payload.mode
    db.commit()
    db.refresh(pref)
    return pref
