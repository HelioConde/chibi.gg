from __future__ import annotations

import re


def normalize_champion_id(raw_id: str) -> str:
    """Normalize known Riot identifiers without assuming every future prefix."""
    value = raw_id.strip().strip("{}[]() ")
    value = re.sub(r"^DA_\d+_", "", value, flags=re.IGNORECASE)
    value = re.sub(r"^DA_", "", value, flags=re.IGNORECASE)
    return value or raw_id
