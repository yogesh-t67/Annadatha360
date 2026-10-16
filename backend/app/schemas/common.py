import re
from typing import Annotated

from pydantic import AfterValidator

_NON_DIGITS = re.compile(r"\D")
_INDIAN_MOBILE = re.compile(r"^[6-9]\d{9}$")


def normalize_indian_mobile(value: str) -> str:
    """Accepts 9876543210, +91 98765 43210, 919876543210, 09876543210 → +919876543210."""
    digits = _NON_DIGITS.sub("", value)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if not _INDIAN_MOBILE.match(digits):
        raise ValueError("Enter a valid 10-digit Indian mobile number")
    return f"+91{digits}"


PhoneNumber = Annotated[str, AfterValidator(normalize_indian_mobile)]
