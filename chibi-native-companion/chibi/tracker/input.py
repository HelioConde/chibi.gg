from __future__ import annotations

import ctypes
import ctypes.wintypes
from dataclasses import dataclass
from time import monotonic

from .events import EventType, TFTEvent


@dataclass(frozen=True, slots=True)
class NormalizedRegion:
    left: float
    top: float
    right: float
    bottom: float
    event: EventType

    def contains(self, x: float, y: float) -> bool:
        return self.left <= x <= self.right and self.top <= y <= self.bottom


TFT_UI_REGIONS = (
    NormalizedRegion(0.22, 0.93, 0.28, 0.99, EventType.SHOP_REROLLED),
    NormalizedRegion(0.21, 0.84, 0.27, 0.90, EventType.XP_PURCHASED),
)


def event_for_position(nx: float, ny: float) -> EventType | None:
    return next((region.event for region in TFT_UI_REGIONS if region.contains(nx, ny)), None)


def event_for_gesture(nx: float, ny: float, duration: float, distance: float) -> EventType | None:
    return event_for_position(nx, ny) if duration < 0.45 and distance < 0.025 else None


class TFTInputProvider:
    """Observes a narrow, non-text subset of input only in the foreground TFT window."""
    name = "InputProvider"

    def __init__(self, window_provider: object | None = None) -> None:
        self.window_provider = window_provider
        self.status = "unavailable" if not hasattr(ctypes, "windll") else "waiting_for_game"
        self._left_down = False
        self._drag_start: tuple[float, float, float] | None = None
        self._keys: dict[int, bool] = {ord("D"): False, ord("F"): False}

    def poll(self) -> list[TFTEvent]:
        if not hasattr(ctypes, "windll"):
            self.status = "unavailable"
            return []
        window = self.window_provider() if callable(self.window_provider) else None
        if window is None:
            self.status = "waiting_for_game"
            self._left_down = False
            return []
        if not self._foreground_matches(window):
            self.status = "idle"
            self._left_down = False
            return []
        self.status = "connected"
        events = self._key_events()
        user32 = ctypes.windll.user32
        point = ctypes.wintypes.POINT()
        user32.GetCursorPos(ctypes.byref(point))
        nx = (point.x - window.left) / max(1, window.width)
        ny = (point.y - window.top) / max(1, window.height)
        down = bool(user32.GetAsyncKeyState(0x01) & 0x8000)
        now = monotonic()
        if down and not self._left_down:
            self._drag_start = (nx, ny, now)
        elif not down and self._left_down and self._drag_start:
            sx, sy, started = self._drag_start
            distance = ((nx - sx) ** 2 + (ny - sy) ** 2) ** 0.5
            duration = now - started
            kind = event_for_gesture(nx, ny, duration, distance)
            if kind:
                events.append(TFTEvent(kind, "TFT_INPUT", {"nx": nx, "ny": ny}, confidence=0.92))
            self._drag_start = None
        self._left_down = down
        return events

    def _key_events(self) -> list[TFTEvent]:
        user32 = ctypes.windll.user32
        events: list[TFTEvent] = []
        for key, kind in ((ord("D"), EventType.SHOP_REROLLED), (ord("F"), EventType.XP_PURCHASED)):
            down = bool(user32.GetAsyncKeyState(key) & 0x8000)
            if down and not self._keys[key]:
                events.append(TFTEvent(kind, "TFT_INPUT", {"key": chr(key)}, confidence=0.98))
            self._keys[key] = down
        return events

    @staticmethod
    def _foreground_matches(window: object) -> bool:
        user32 = ctypes.windll.user32
        return user32.GetForegroundWindow() == window.handle
