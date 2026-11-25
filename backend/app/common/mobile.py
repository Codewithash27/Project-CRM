"""Shared mobile-number cleanup. Stored value is digits only, 10 or 12 long."""

import re


def normalize_mobile(value: str | None) -> str | None:
    if value is None:
        return None
    digits = re.sub(r"\D+", "", value.strip())
    if not digits:
        return None
    if len(digits) not in (10, 12):
        raise ValueError("Mobile number must be 10 or 12 digits.")
    return digits
