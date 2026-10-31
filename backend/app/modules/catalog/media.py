"""Public images (product photos). Unlike KYC documents these are meant to be seen by anyone, so they are stored
unencrypted and served without a login. Local disk now; S3 + CloudFront with the AWS setup."""

import re
import uuid
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings
from app.core.errors import AppError
from app.modules.documents.kinds import sniff_content_type

IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
_NAME = re.compile(r"^[0-9a-f-]{36}\.(jpg|png|webp)$")


class LocalMedia:
    def __init__(self, root: str | Path):
        self.root = Path(root)

    def path(self, name: str) -> Path:
        if not _NAME.match(name):
            raise ValueError(f"Bad media name: {name!r}")
        return self.root / "catalog" / name

    def save_image(self, data: bytes) -> str:
        """Checks and stores an image; returns its name (the key kept on the listing)."""
        max_bytes = get_settings().media_max_mb * 1024 * 1024
        if not data:
            raise AppError(422, "empty_file", "The file is empty")
        if len(data) > max_bytes:
            raise AppError(413, "file_too_large", f"Image is larger than {get_settings().media_max_mb} MB")
        content_type = sniff_content_type(data)
        if content_type not in IMAGE_TYPES:
            raise AppError(415, "unsupported_file_type", "Only JPG, PNG or WebP images")
        name = f"{uuid.uuid4()}.{IMAGE_TYPES[content_type]}"
        path = self.path(name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return name

    def delete(self, name: str) -> None:
        self.path(name).unlink(missing_ok=True)


def media_url(name: str) -> str:
    return f"/api/v1/media/catalog/{name}"


@lru_cache
def get_media() -> LocalMedia:
    return LocalMedia(get_settings().media_dir)
