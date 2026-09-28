from __future__ import annotations

import logging
from dataclasses import replace
from time import time
from typing import Any

from .models import BRIDGE_VERSION, LiveValue, TftLiveUnit, TftTelemetry


LOGGER = logging.getLogger("chibi.live_bridge")


class TelemetryState:
    """Validates local bridge messages without coupling telemetry to LCU gameflow."""

    def __init__(self, stale_after_seconds: float = 10.0) -> None:
        self.stale_after_seconds = stale_after_seconds
        self.telemetry = TftTelemetry()

    def receive(self, message: object) -> bool:
        if not isinstance(message, dict) or message.get("version") != BRIDGE_VERSION:
            return False
        message_type = message.get("type")
        if message_type == "hello":
            self.telemetry = replace(self.telemetry, connected=True, updated_at=time())
            return True
        if message_type == "heartbeat":
            self.telemetry = replace(self.telemetry, connected=True, updated_at=time())
            return True
        if message_type != "tft_live_snapshot" or not isinstance(message.get("data"), dict):
            return False
        self.telemetry = self._merge(message["data"], float(message.get("timestamp", time())) / 1000)
        return True

    def mark_disconnected(self) -> None:
        self.telemetry = replace(self.telemetry, connected=False)

    def refresh_staleness(self, now: float | None = None) -> TftTelemetry:
        now = now or time()
        def stale(value: LiveValue[Any]) -> LiveValue[Any]:
            return replace(value, stale=value.available and now - value.updated_at > self.stale_after_seconds)
        self.telemetry = replace(
            self.telemetry,
            stage=stale(self.telemetry.stage), gold=stale(self.telemetry.gold), hp=stale(self.telemetry.hp),
            level=stale(self.telemetry.level), xp=stale(self.telemetry.xp), board=stale(self.telemetry.board),
            bench=stale(self.telemetry.bench), store=stale(self.telemetry.store),
        )
        return self.telemetry

    def _merge(self, data: dict[str, object], timestamp: float) -> TftTelemetry:
        me = data.get("me") if isinstance(data.get("me"), dict) else {}
        match = data.get("match_info") if isinstance(data.get("match_info"), dict) else {}
        return TftTelemetry(
            connected=True,
            game_running=bool(data.get("gameRunning", self.telemetry.game_running)),
            stage=self._value(match.get("stage"), str, timestamp, self.telemetry.stage),
            gold=self._value(me.get("gold"), int, timestamp, self.telemetry.gold),
            hp=self._value(me.get("health"), int, timestamp, self.telemetry.hp),
            level=self._value(me.get("level"), int, timestamp, self.telemetry.level),
            xp=self._value(me.get("xp"), int, timestamp, self.telemetry.xp),
            board=self._units(data.get("board"), timestamp, self.telemetry.board),
            bench=self._units(data.get("bench"), timestamp, self.telemetry.bench),
            store=self._units(data.get("store"), timestamp, self.telemetry.store),
            updated_at=timestamp,
        )

    @staticmethod
    def _value(value: object, kind: type, timestamp: float, previous: LiveValue[Any]) -> LiveValue[Any]:
        return LiveValue.current(value, timestamp) if isinstance(value, kind) else previous

    @staticmethod
    def _units(value: object, timestamp: float, previous: LiveValue[tuple[TftLiveUnit, ...]]) -> LiveValue[tuple[TftLiveUnit, ...]]:
        if not isinstance(value, list):
            return previous
        units: list[TftLiveUnit] = []
        for raw in value:
            if not isinstance(raw, dict):
                continue
            items = raw.get("items", [])
            units.append(TftLiveUnit(
                id=raw.get("id") if isinstance(raw.get("id"), str) else None,
                name=raw.get("name") if isinstance(raw.get("name"), str) else None,
                star_level=raw.get("starLevel") if isinstance(raw.get("starLevel"), int) else None,
                position=raw.get("position"),
                items=tuple(item for item in items if isinstance(item, str)) if isinstance(items, list) else (),
                updated_at=timestamp,
            ))
        return LiveValue.current(tuple(units), timestamp)
