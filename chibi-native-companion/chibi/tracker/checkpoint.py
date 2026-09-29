from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from .events import EventType, TFTEvent

LOGGER = logging.getLogger("chibi.native.tracker")


class TFTCheckpointProvider:
    name = "Checkpoint"

    def __init__(self, puuid: str = "", root: Path | None = None) -> None:
        local = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        self.root = root or local / "TFT"
        self.puuid = puuid
        self.status = "waiting"
        self._marker: tuple[Path, int, int] | None = None

    def set_puuid(self, puuid: str) -> None:
        self.puuid = puuid

    def _find_file(self) -> Path | None:
        try:
            files = [path for path in self.root.rglob("TFTEoGStats.json") if path.is_file()]
            return max(files, key=lambda item: item.stat().st_mtime) if files else None
        except OSError:
            return None

    def poll(self) -> list[TFTEvent]:
        path = self._find_file()
        if path is None:
            self.status = "waiting"
            return []
        try:
            stat = path.stat()
            marker = (path, stat.st_mtime_ns, stat.st_size)
        except OSError:
            self.status = "waiting"
            return []
        if marker == self._marker:
            return []
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            self.status = "waiting"
            return []  # Do not advance marker; TFT may still be writing JSON.
        if not self.puuid:
            self.status = "waiting_puuid"
            return []
        player = _find_player(raw, self.puuid)
        if player is None:
            self.status = "waiting_local_player"
            LOGGER.info("[Checkpoint] local player not found")
            return []
        self._marker = marker
        self.status = "connected"
        payload = {
            "gameId": _first_string(raw, "gameId"),
            "setCoreName": _first_string(raw, "setCoreName"),
            "health": _first_int(player, "health", "hp"),
            "augments": _first_list(player, "augments"),
            "boardPieces": _first_list(player, "boardPieces"),
        }
        LOGGER.info("[Checkpoint] updated board=%s", len(payload["boardPieces"]))
        return [TFTEvent(EventType.CHECKPOINT_UPDATED, "TFT_CHECKPOINT", payload)]


def _find_player(value: Any, puuid: str) -> dict[str, Any] | None:
    if isinstance(value, dict):
        candidate = str(value.get("puuid") or value.get("PUUID") or value.get("playerPuuid") or "")
        if candidate == puuid:
            return value
        for child in value.values():
            found = _find_player(child, puuid)
            if found is not None:
                return found
    elif isinstance(value, list):
        for child in value:
            found = _find_player(child, puuid)
            if found is not None:
                return found
    return None


def _first_string(value: Any, key: str) -> str | None:
    if isinstance(value, dict) and value.get(key) is not None:
        return str(value[key])
    return None


def _first_int(value: Any, *keys: str) -> int | None:
    if isinstance(value, dict):
        for key in keys:
            if isinstance(value.get(key), int):
                return value[key]
    return None


def _first_list(value: Any, key: str) -> list[Any]:
    return list(value.get(key) or []) if isinstance(value, dict) and isinstance(value.get(key), list) else []
