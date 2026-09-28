from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from .models import OverlaySnapshot


DEFAULT_SNAPSHOT = {
    "player": "",
    "rank": "Perfil Chibi ainda não conectado",
    "focus": "Revise uma decisão por vez.",
    "avoid": "",
    "stage": "—",
    "hp": None,
    "gold": None,
    "level": None,
    "streak": "—",
    "status": "SNAPSHOT INDISPONÍVEL",
    "score": None,
    "review_questions": [],
    "board": [],
    "updated_at": "",
}

DEMO_SNAPSHOT = {
    **DEFAULT_SNAPSHOT,
    "player": "Demo#CHIBI",
    "rank": "Snapshot de demonstração",
    "focus": "Compare este momento com uma partida parecida depois da fila.",
    "stage": "3-2",
    "hp": 72,
    "gold": 38,
    "level": 6,
    "streak": "W2",
    "status": "REVIEW SNAPSHOT",
    "score": 68,
    "board": [
        {"slot": 15, "label": "T", "role": "tank"},
        {"slot": 16, "label": "F", "role": "tank"},
        {"slot": 18, "label": "U", "role": "utility"},
        {"slot": 22, "label": "C", "role": "carry"},
        {"slot": 23, "label": "S", "role": "carry"},
    ],
    "updated_at": "demo",
}


def app_data_dir() -> Path:
    if os.name == "nt":
        root = Path(os.environ.get("APPDATA", Path.home()))
    else:
        root = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    path = root / "ChibiOverlay"
    path.mkdir(parents=True, exist_ok=True)
    return path


class LocalStore:
    def __init__(self, snapshot_path: str | None = None, *, demo: bool = False) -> None:
        self.settings_path = app_data_dir() / "settings.json"
        self.snapshot_path = Path(snapshot_path).expanduser().resolve() if snapshot_path else app_data_dir() / "snapshot.json"
        self._last_snapshot_mtime: float | None = None
        self.demo = demo
        self.ensure_snapshot()

    def ensure_snapshot(self) -> None:
        if self.snapshot_path.exists():
            return
        self.snapshot_path.parent.mkdir(parents=True, exist_ok=True)
        self.snapshot_path.write_text(
            json.dumps(DEMO_SNAPSHOT if self.demo else DEFAULT_SNAPSHOT, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def load_settings(self) -> dict[str, Any]:
        if not self.settings_path.exists():
            return {}
        try:
            data = json.loads(self.settings_path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except (OSError, json.JSONDecodeError):
            return {}

    def save_settings(self, data: dict[str, Any]) -> None:
        try:
            self.settings_path.write_text(
                json.dumps(data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except OSError:
            pass

    def snapshot_changed(self) -> bool:
        try:
            mtime = self.snapshot_path.stat().st_mtime
        except OSError:
            return False

        if self._last_snapshot_mtime is None:
            self._last_snapshot_mtime = mtime
            return True

        if mtime != self._last_snapshot_mtime:
            self._last_snapshot_mtime = mtime
            return True

        return False

    def load_snapshot(self) -> OverlaySnapshot:
        try:
            raw = json.loads(self.snapshot_path.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                raise ValueError("snapshot root must be an object")
            return OverlaySnapshot.from_dict(raw)
        except (OSError, json.JSONDecodeError, ValueError, TypeError):
            return OverlaySnapshot.from_dict(DEMO_SNAPSHOT if self.demo else DEFAULT_SNAPSHOT)
