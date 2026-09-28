from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .connection import LcuConnection, LcuUnavailableError


SENSITIVE_KEY_PARTS = (
    "password",
    "authorization",
    "token",
    "spectator",
    "cookie",
    "credential",
    "secret",
    "puuid",
    "summonerid",
    "gamename",
    "displayname",
    "serverip",
    "serverport",
    "gameid",
)


def sanitize_lcu_payload(value: object) -> object:
    """Preserve payload shape while removing credentials and personal identifiers."""
    if isinstance(value, dict):
        sanitized: dict[str, object] = {}
        for key, item in value.items():
            key_text = str(key)
            if any(part in key_text.casefold() for part in SENSITIVE_KEY_PARTS):
                sanitized[key_text] = "[redacted]"
            else:
                sanitized[key_text] = sanitize_lcu_payload(item)
        return sanitized
    if isinstance(value, list):
        return [sanitize_lcu_payload(item) for item in value]
    return value


def write_sanitized_gameflow_session(debug_dir: Path) -> Path:
    """Save the existing gameflow session endpoint only; never print raw payloads."""
    try:
        payload = LcuConnection().get_json("/lol-gameflow/v1/session")
    except LcuUnavailableError:
        raise
    debug_dir.mkdir(parents=True, exist_ok=True)
    output = debug_dir / "gameflow-session-sanitized.json"
    output.write_text(
        json.dumps(sanitize_lcu_payload(payload), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return output
