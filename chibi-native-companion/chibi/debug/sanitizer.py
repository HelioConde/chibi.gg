from __future__ import annotations
from typing import Any
SENSITIVE = ("password", "token", "authorization", "cookie", "secret", "credential", "spectator", "puuid", "summonerid")
def sanitize(value: Any) -> Any:
    if isinstance(value, list): return [sanitize(item) for item in value]
    if isinstance(value, dict): return {key: "[redacted]" if any(part in key.casefold() for part in SENSITIVE) else sanitize(child) for key, child in value.items()}
    return value
