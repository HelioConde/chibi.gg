from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def app_data_dir() -> Path:
    root = Path(os.environ.get("APPDATA", Path.home())) if os.name == "nt" else Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    path = root / "ChibiNative"
    path.mkdir(parents=True, exist_ok=True)
    return path


class Settings:
    def __init__(self) -> None:
        self.path = app_data_dir() / "settings.json"

    def load(self) -> dict[str, Any]:
        try:
            value = json.loads(self.path.read_text(encoding="utf-8"))
            return value if isinstance(value, dict) else {}
        except (OSError, ValueError):
            return {}

    def update(self, values: dict[str, Any]) -> None:
        data = self.load()
        data.update(values)
        self.path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
