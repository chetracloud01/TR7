"""LLM provider key vault — docs/MASTER_PLAN.md §4.

/test is a format-validation stub for now: it confirms the key looks like
a real key for that provider without spending a call. Actually pinging
the provider's API is part of the LLM Gateway (Phase 3)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import decrypt_secret, encrypt_secret, mask_secret
from app.db.models.llm import LLMProvider
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.providers import ProviderOut, ProviderTestResult, ProviderUpsert

router = APIRouter()

# Loose format checks — good enough to catch "pasted the wrong thing,"
# not a substitute for actually calling the provider (Phase 3).
_KEY_PREFIXES = {
    "anthropic": "sk-ant-",
    "openai": "sk-",
    "xai": "xai-",
    "deepseek": "sk-",
}
_KEYLESS_PROVIDERS = {"ollama"}


def _to_out(p: LLMProvider) -> ProviderOut:
    return ProviderOut(
        id=p.id,
        name=p.name,
        enabled=p.enabled,
        capabilities=p.capabilities,
        connected=p.name in _KEYLESS_PROVIDERS or bool(p.api_key_encrypted),
        masked_key=mask_secret(decrypt_secret(p.api_key_encrypted)) if p.api_key_encrypted else None,
    )


@router.get("/providers", response_model=list[ProviderOut])
def list_providers(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ProviderOut]:
    rows = db.scalars(select(LLMProvider).where(LLMProvider.user_id == user.id)).all()
    return [_to_out(p) for p in rows]


@router.post("/providers", response_model=ProviderOut)
def upsert_provider(
    payload: ProviderUpsert, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ProviderOut:
    provider = db.scalar(
        select(LLMProvider).where(LLMProvider.user_id == user.id, LLMProvider.name == payload.name)
    )
    if provider is None:
        provider = LLMProvider(user_id=user.id, name=payload.name)
        db.add(provider)

    provider.enabled = payload.enabled
    provider.capabilities = payload.capabilities
    if payload.api_key:
        provider.api_key_encrypted = encrypt_secret(payload.api_key)

    db.commit()
    db.refresh(provider)
    return _to_out(provider)


@router.delete("/providers/{provider_id}")
def delete_provider(
    provider_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict[str, bool]:
    provider = db.get(LLMProvider, provider_id)
    if provider is None or provider.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    db.delete(provider)
    db.commit()
    return {"ok": True}


@router.post("/providers/{provider_id}/test", response_model=ProviderTestResult)
def test_provider(
    provider_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ProviderTestResult:
    provider = db.get(LLMProvider, provider_id)
    if provider is None or provider.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")

    if provider.name in _KEYLESS_PROVIDERS:
        return ProviderTestResult(ok=True, message="No key needed for a local provider.")

    if not provider.api_key_encrypted:
        return ProviderTestResult(ok=False, message="No key saved yet.")

    key = decrypt_secret(provider.api_key_encrypted)
    expected_prefix = _KEY_PREFIXES.get(provider.name)
    if expected_prefix and not key.startswith(expected_prefix):
        return ProviderTestResult(ok=False, message=f'Doesn\'t look like a {provider.name} key (expected "{expected_prefix}...").')
    if len(key) < 20:
        return ProviderTestResult(ok=False, message="Key looks too short to be real.")

    return ProviderTestResult(ok=True, message="Format looks right. Live connectivity check lands in Phase 3.")
