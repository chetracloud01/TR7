"""Encryption helpers for storing LLM provider API keys at rest.

Never store a provider key in plaintext, even in a personal-use DB —
see docs/MASTER_PLAN.md section 3 ("Secrets").
"""

from cryptography.fernet import Fernet

from app.core.config import get_settings


def _fernet() -> Fernet:
    key = get_settings().secret_encryption_key
    # Fernet requires a 32-byte urlsafe-base64 key; pad/derive a usable one
    # from arbitrary settings so local dev works without extra setup, while
    # production is expected to set a real generated Fernet key.
    if len(key) != 44:
        import base64
        import hashlib

        digest = hashlib.sha256(key.encode()).digest()
        key = base64.urlsafe_b64encode(digest).decode()
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode()).decode()
