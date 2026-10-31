"""Encryption for secrets stored in database columns (authenticator keys, later bank account numbers).

Hashes are used where we only need to compare (passwords, tokens); this is for values we must read back.
"""

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet

from app.core.config import get_settings


@lru_cache
def _fernet() -> Fernet:
    settings = get_settings()
    key = settings.field_encryption_key
    if not key:  # development and tests only — production refuses to start without its own key
        digest = hashlib.sha256(("field-encryption:" + settings.jwt_secret).encode()).digest()
        key = base64.urlsafe_b64encode(digest).decode()
    return Fernet(key)


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    return _fernet().decrypt(value.encode()).decode()
