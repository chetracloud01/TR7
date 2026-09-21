"""Encryption/hashing/session helpers.

Never store a provider key or a password in plaintext, even in a
personal-use DB — see docs/MASTER_PLAN.md section 3 ("Secrets").
"""

import bcrypt
from cryptography.fernet import Fernet
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

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


def mask_secret(plain: str) -> str:
    """"sk-ant-api03-abc...xyz4f2c" -> "sk-ant-••••••••••••4f2c" for display."""
    if len(plain) <= 10:
        return "•" * len(plain)
    return f"{plain[:7]}{'•' * 12}{plain[-4:]}"


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().session_secret, salt="tr7-session")


def create_session_token(user_id: int) -> str:
    return _serializer().dumps({"user_id": user_id})


def read_session_token(token: str) -> int | None:
    """Returns the user_id if the token is validly signed and not expired,
    else None — never raises, so callers just check for a session."""
    try:
        data = _serializer().loads(token, max_age=get_settings().session_max_age_seconds)
    except (BadSignature, SignatureExpired):
        return None
    return data.get("user_id")
