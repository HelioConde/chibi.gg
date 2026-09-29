from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from .events import EventType, TFTEvent

LOGGER = logging.getLogger("chibi.native.tracker")


class TFTHeartbeatProvider:
    name = "Heartbeat"

    def __init__(self, root: Path | None = None) -> None:
        local = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        self.root = root or local / "Riot Games" / "Riot Client" / "Data" / "Sessions"
        self.status = "waiting"
        self._last_key: tuple[object, ...] | None = None

    def poll(self) -> list[TFTEvent]:
        try:
            candidates = [path for path in self.root.rglob("*.heartbeat.json") if path.is_file()]
            path = max(candidates, key=lambda item: item.stat().st_mtime)
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            self.status = "waiting"
            return []
        if not isinstance(data, dict):
            self.status = "waiting"
            return []
        source = data.get("source") if isinstance(data.get("source"), dict) else {}
        payload = data.get("data") if isinstance(data.get("data"), dict) else {}
        if str(data.get("productId") or source.get("productId") or "").casefold() != "teamfighttactics":
            self.status = "waiting"
            return []
        phase = str(data.get("phase") or payload.get("phase") or "unknown")
        raw_pid = data.get("pid") or source.get("pid")
        pid = raw_pid if isinstance(raw_pid, int) else None
        lifecycle = "game_running" if phase.casefold() == "gameplay" else "tft_open"
        key = (phase, pid)
        self.status = "connected"
        if key == self._last_key:
            return []
        self._last_key = key
        LOGGER.info("[Heartbeat] product=teamfighttactics phase=%s pid=%s", phase, pid)
        return [TFTEvent(EventType.HEARTBEAT_UPDATED, "TFT_HEARTBEAT", {"phase": phase, "pid": pid, "lifecycle": lifecycle})]
