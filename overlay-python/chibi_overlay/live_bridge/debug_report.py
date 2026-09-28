from __future__ import annotations

import json
import logging
from pathlib import Path
from time import time
from typing import Any

from chibi_overlay.storage import app_data_dir


LOGGER = logging.getLogger("chibi.live_bridge")
FEATURES = ("me", "match_info", "board", "bench", "store")


class OverwolfDebugReport:
    """Persists only sanitized validation metadata; it never feeds the overlay UI."""

    def __init__(self, debug_dir: Path | None = None) -> None:
        self.debug_dir = debug_dir or app_data_dir() / "debug"
        self.status: dict[str, Any] = {
            "game_detected": False,
            "game_id": None,
            "features": {feature: "not_seen" for feature in FEATURES},
            "features_requested": [],
            "features_enabled": [],
            "bridge_connected": False,
            "last_event_at": None,
        }
        self.validation: dict[str, Any] = {
            "game_detected": False,
            "game_id": None,
            "features_requested": [],
            "features_enabled": [],
            "observed": {key: False for key in ("gold", "health", "level", "stage", "board", "bench", "store")},
            "bridge": {"connected": False, "snapshots_sent": 0},
        }
        self._overwolf_source = False
        self._write()

    def receive(self, message: dict[str, object]) -> None:
        message_type = message.get("type")
        data = message.get("data") if isinstance(message.get("data"), dict) else {}
        self.status["last_event_at"] = int(time() * 1000)
        if message_type == "hello":
            self._overwolf_source = data.get("source") == "chibi-overwolf"
            self.status["bridge_connected"] = True
            self.validation["bridge"]["connected"] = True
        elif message_type == "overwolf_game_status":
            running = bool(data.get("gameRunning"))
            game_id = data.get("gameId") if isinstance(data.get("gameId"), int) else None
            self.status.update(game_detected=running, game_id=game_id)
            self.validation.update(game_detected=running, game_id=game_id)
        elif message_type == "feature_status":
            requested = data.get("requested") if isinstance(data.get("requested"), list) else []
            enabled = data.get("supported") if isinstance(data.get("supported"), list) else []
            self.status["features_requested"] = [item for item in requested if isinstance(item, str)]
            self.status["features_enabled"] = [item for item in enabled if isinstance(item, str)]
            self.validation["features_requested"] = self.status["features_requested"]
            self.validation["features_enabled"] = self.status["features_enabled"]
            if data.get("success") is False:
                for feature in self.status["features_requested"]:
                    if feature in self.status["features"] and self.status["features"][feature] == "not_seen":
                        self.status["features"][feature] = "failed"
        elif message_type == "gep_debug":
            self._capture_first_payload(data)
        elif message_type == "tft_live_snapshot" and self._overwolf_source:
            self._record_snapshot(data)
        self._write()

    def mark_disconnected(self) -> None:
        self.status["bridge_connected"] = False
        self.validation["bridge"]["connected"] = False
        self._write()

    def _capture_first_payload(self, data: dict[str, object]) -> None:
        if data.get("kind") != "first_payload":
            return
        feature = data.get("feature")
        payload = data.get("payload")
        if feature not in FEATURES or not isinstance(payload, (dict, list, str, int, float, bool, type(None))):
            return
        self.status["features"][feature] = "observed"
        path = self.debug_dir / f"{feature}.first.json"
        if not path.exists():
            self._write_json(path, payload)

    def _record_snapshot(self, data: dict[str, object]) -> None:
        self.validation["bridge"]["snapshots_sent"] += 1
        me = data.get("me") if isinstance(data.get("me"), dict) else {}
        match = data.get("match_info") if isinstance(data.get("match_info"), dict) else {}
        observed = self.validation["observed"]
        observed["gold"] = observed["gold"] or isinstance(me.get("gold"), (int, float))
        observed["health"] = observed["health"] or isinstance(me.get("health"), (int, float))
        observed["level"] = observed["level"] or isinstance(me.get("level"), (int, float))
        observed["stage"] = observed["stage"] or isinstance(data.get("stage"), str) or isinstance(match.get("stage"), str)
        for key in ("board", "bench", "store"):
            observed[key] = observed[key] or isinstance(data.get(key), list)

    def _write(self) -> None:
        self._write_json(self.debug_dir / "overwolf-status.json", self.status)
        self._write_json(self.debug_dir / "overwolf-validation-report.json", self.validation)

    def _write_json(self, path: Path, data: object) -> None:
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        except OSError as error:
            LOGGER.debug("[BRIDGE] debug report unavailable: %s", error)
