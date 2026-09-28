from __future__ import annotations

import json
from enum import Enum
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


class DataConfidence(str, Enum):
    VERIFIED = "verified"
    OBSERVED = "observed"
    UNVERIFIED = "unverified"
    UNAVAILABLE = "unavailable"


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


def extract_schema(payload: object) -> list[dict[str, object]]:
    """Return a value-free schema. Sensitive field paths are excluded entirely."""
    entries: dict[str, dict[str, object]] = {}

    def record(path: str, value: object, *, occurrences: int = 1) -> None:
        if not path or _is_sensitive_path(path):
            return
        value_type = _schema_type(value)
        existing = entries.get(path)
        if existing is None:
            existing = {"path": path, "type": value_type, "count": 0}
            entries[path] = existing
        existing["count"] = int(existing["count"]) + occurrences
        if existing["type"] != value_type:
            existing["type"] = "mixed"
        if isinstance(value, (list, dict)):
            existing["list_length" if isinstance(value, list) else "field_count"] = len(value)

    def visit(value: object, path: str) -> None:
        record(path, value)
        if isinstance(value, dict):
            for key, child in value.items():
                child_path = f"{path}.{key}" if path else str(key)
                if not _is_sensitive_path(child_path):
                    visit(child, child_path)
        elif isinstance(value, list):
            for child in value:
                visit(child, f"{path}[]")

    visit(payload, "")
    return [entries[path] for path in sorted(entries)]


def schema_diff(
    before: list[dict[str, object]], after: list[dict[str, object]]
) -> dict[str, list[dict[str, object]]]:
    """Compare value-free schemas by path, type and list length."""
    before_by_path = {str(item["path"]): item for item in before}
    after_by_path = {str(item["path"]): item for item in after}
    added = [after_by_path[path] for path in sorted(after_by_path.keys() - before_by_path.keys())]
    removed = [before_by_path[path] for path in sorted(before_by_path.keys() - after_by_path.keys())]
    changed: list[dict[str, object]] = []
    for path in sorted(before_by_path.keys() & after_by_path.keys()):
        old, new = before_by_path[path], after_by_path[path]
        changes: dict[str, object] = {"path": path}
        if old.get("type") != new.get("type"):
            changes["type"] = {"before": old.get("type"), "after": new.get("type")}
        if old.get("list_length") != new.get("list_length"):
            changes["list_length"] = {
                "before": old.get("list_length"),
                "after": new.get("list_length"),
            }
        if changes.keys() != {"path"}:
            changed.append(changes)
    return {"added": added, "removed": removed, "changed": changed}


def write_gameflow_schema(debug_dir: Path) -> tuple[Path, Path]:
    """Record one known LCU endpoint as schema only, then update its phase report."""
    payload = LcuConnection().get_json("/lol-gameflow/v1/session")
    if not isinstance(payload, dict):
        raise LcuUnavailableError("A API local retornou uma sessão inválida.")
    debug_dir.mkdir(parents=True, exist_ok=True)
    phase = str(payload.get("phase") or "Unknown")
    phase_key = _phase_key(phase)
    schema = extract_schema(payload)
    schema_path = debug_dir / f"{phase_key}-schema.json"
    last_path = debug_dir / "last-gameflow-schema.json"
    last = _read_json(last_path)
    last_fields = last.get("fields", []) if isinstance(last, dict) else []
    phase_diff = schema_diff(last_fields, schema) if isinstance(last_fields, list) else schema_diff([], schema)
    changed_paths = {
        str(item["path"])
        for group in ("added", "changed")
        for item in phase_diff[group]
    }
    schema = [{**entry, "changed": str(entry["path"]) in changed_paths} for entry in schema]
    schema_path.write_text(
        json.dumps({"endpoint": "/lol-gameflow/v1/session", "phase": phase, "fields": schema}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    diff_path = debug_dir / "gameflow-schema-diff.json"
    diff_path.write_text(
        json.dumps(
            {"before_phase": last.get("phase") if isinstance(last, dict) else None, "after_phase": phase, **phase_diff},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    last_path.write_text(
        json.dumps({"phase": phase, "fields": schema}, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    if phase_key == "ingame":
        first_path = debug_dir / "ingame-schema-first.json"
        if not first_path.exists():
            first_path.write_text(schema_path.read_text(encoding="utf-8"), encoding="utf-8")
        (debug_dir / "ingame-schema-last.json").write_text(schema_path.read_text(encoding="utf-8"), encoding="utf-8")
        first = _read_schema(first_path)
        (debug_dir / "ingame-schema-accumulated-diff.json").write_text(
            json.dumps(schema_diff(first, schema), ensure_ascii=False, indent=2), encoding="utf-8"
        )

    report_path = _update_investigation_report(debug_dir, phase, schema)
    return schema_path, report_path


def _update_investigation_report(
    debug_dir: Path, phase: str, fields: list[dict[str, object]]
) -> Path:
    report_path = debug_dir / "investigation-report.json"
    report = _read_json(report_path)
    sources = report.get("sources", []) if isinstance(report, dict) else []
    source = {
        "endpoint": "/lol-gameflow/v1/session",
        "phase": phase,
        "confidence": DataConfidence.OBSERVED.value,
        "fields": [field["path"] for field in fields],
        "local_units": False,
        "opponent_units": False,
        "owner": False,
        "position": False,
        "star_level": False,
        "items": False,
        "bench": False,
        "current_opponent": False,
    }
    sources = [item for item in sources if not (item.get("endpoint") == source["endpoint"] and item.get("phase") == phase)]
    sources.append(source)
    report_path.write_text(json.dumps({"sources": sources}, ensure_ascii=False, indent=2), encoding="utf-8")
    return report_path


def _read_json(path: Path) -> dict[str, object]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _read_schema(path: Path) -> list[dict[str, object]]:
    data = _read_json(path).get("fields", [])
    return [item for item in data if isinstance(item, dict)] if isinstance(data, list) else []


def _schema_type(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "str"
    if isinstance(value, list):
        return "list"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def _is_sensitive_path(path: str) -> bool:
    return any(part in path.casefold() for part in SENSITIVE_KEY_PARTS)


def _phase_key(phase: str) -> str:
    return {
        "Lobby": "lobby",
        "Matchmaking": "matchmaking",
        "ReadyCheck": "readycheck",
        "ChampSelect": "champselect",
        "InProgress": "ingame",
        "PreEndOfGame": "postgame",
        "EndOfGame": "postgame",
        "PostGame": "postgame",
    }.get(phase, "unknown")
