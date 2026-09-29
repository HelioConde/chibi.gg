from __future__ import annotations

from dataclasses import dataclass
from time import monotonic
from typing import Callable

from .events import EventType, TFTEvent
from .values import parse_round, valid_gold, valid_level


@dataclass(frozen=True, slots=True)
class NormalizedRoi:
    x: float
    y: float
    width: float
    height: float

    def bounds(self, frame_width: int, frame_height: int) -> tuple[int, int, int, int]:
        left = max(0, min(frame_width - 1, round(self.x * frame_width)))
        top = max(0, min(frame_height - 1, round(self.y * frame_height)))
        width = max(1, min(frame_width - left, round(self.width * frame_width)))
        height = max(1, min(frame_height - top, round(self.height * frame_height)))
        return left, top, width, height


class TFTVisionLayout:
    """HUD regions are client-relative; a resize is handled on every capture."""
    GOLD = NormalizedRoi(0.50, 0.79, 0.07, 0.07)
    LEVEL = NormalizedRoi(0.18, 0.79, 0.12, 0.07)
    ROUND = NormalizedRoi(0.36, 0.00, 0.08, 0.05)


class VisionValueProvider:
    """Throttled, opt-in visual fallback. No capture happens outside Gameplay."""

    def __init__(
        self, name: str, event_type: EventType, roi: NormalizedRoi,
        lifecycle: Callable[[], str], validator: Callable[[object], object | None],
        reader: Callable[[NormalizedRoi], tuple[object, float] | None] | None = None,
        interval_seconds: float = 0.5, clock: Callable[[], float] = monotonic,
    ) -> None:
        self.name, self.event_type, self.roi = name, event_type, roi
        self.lifecycle, self.validator, self.reader = lifecycle, validator, reader
        self.interval_seconds, self.clock = interval_seconds, clock
        self.status = "waiting_templates" if reader is None else "waiting_for_game"
        self._next_attempt = 0.0
        self._last_value: object | None = None

    def poll(self) -> list[TFTEvent]:
        if self.lifecycle() != "game_running":
            self.status = "disabled"
            return []
        now = self.clock()
        if now < self._next_attempt:
            return []
        self._next_attempt = now + self.interval_seconds
        if self.reader is None:
            self.status = "waiting_templates"
            return []
        result = self.reader(self.roi)
        if result is None:
            self.status = "waiting_read"
            return []
        raw, confidence = result
        value = self.validator(raw)
        if value is None:
            self.status = "waiting_valid_value"
            return []
        self.status = "connected"
        if value == self._last_value:
            return []
        self._last_value = value
        return [TFTEvent(self.event_type, "VISION", {"value": value}, confidence=float(confidence))]


def vision_level_provider(lifecycle: Callable[[], str], reader: Callable[[NormalizedRoi], tuple[object, float] | None] | None = None) -> VisionValueProvider:
    return VisionValueProvider("VisionLevel", EventType.LEVEL_UPDATED, TFTVisionLayout.LEVEL, lifecycle, lambda value: value if valid_level(value) else None, reader, 0.7)


def vision_gold_provider(lifecycle: Callable[[], str], reader: Callable[[NormalizedRoi], tuple[object, float] | None] | None = None) -> VisionValueProvider:
    return VisionValueProvider("VisionGold", EventType.GOLD_UPDATED, TFTVisionLayout.GOLD, lifecycle, lambda value: value if valid_gold(value) else None, reader, 0.35)


def vision_round_provider(lifecycle: Callable[[], str], reader: Callable[[NormalizedRoi], tuple[object, float] | None] | None = None) -> VisionValueProvider:
    return VisionValueProvider("VisionRound", EventType.ROUND_UPDATED, TFTVisionLayout.ROUND, lifecycle, parse_round, reader, 0.7)
