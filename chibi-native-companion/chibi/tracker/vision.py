from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from pathlib import Path
from time import monotonic, time
from typing import Callable

from chibi.core.settings import app_data_dir
from chibi.vision.capture import CapturedFrame, VisionCapture
from chibi.vision.window import GameWindow, find_tft_window

from .events import EventType, TFTEvent
from .values import parse_round, valid_gold, valid_level

LOGGER = logging.getLogger("chibi.native.tracker")


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
    """Client-area HUD regions, measured as normalized TFT-window coordinates."""

    # Validated against the current TFT client HUD: all three fields share the
    # top client bar, not the lower board/shop area.
    ROUND = NormalizedRoi(0.38, 0.01, 0.07, 0.04)
    GOLD = NormalizedRoi(0.592, 0.01, 0.028, 0.04)
    LEVEL = NormalizedRoi(0.628, 0.007, 0.028, 0.04)


class RestrictedHudOcr:
    """ROI-only OCR; each result is then constrained by its field validator."""

    def __init__(self) -> None:
        self._engine: object | None = None
        self._unavailable = False

    def read(self, rgb: bytes, width: int, height: int) -> tuple[str, float] | None:
        if self._unavailable:
            return None
        try:
            import cv2
            import numpy as np
            from rapidocr_onnxruntime import RapidOCR

            if self._engine is None:
                self._engine = RapidOCR()
            image = np.frombuffer(rgb, dtype=np.uint8).reshape((height, width, 3))
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            gray = cv2.resize(gray, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
            gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
            result, _elapsed = self._engine(gray)  # type: ignore[misc]
            if not result:
                return None
            text = "".join(str(row[1]) for row in result if len(row) > 1)
            scores = [float(row[2]) for row in result if len(row) > 2]
            return text, (sum(scores) / len(scores) if scores else 0.0)
        except ImportError:
            self._unavailable = True
            return None
        except Exception as error:
            LOGGER.debug("[VisionOCR] read failed: %s", type(error).__name__)
            return None


def recognize_saved_roi(path: Path) -> tuple[str, float] | None:
    """Runs the same restricted OCR path against one saved ROI image."""
    try:
        import cv2
        image = cv2.imread(str(path))
        if image is None:
            return None
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        return RestrictedHudOcr().read(rgb.tobytes(), rgb.shape[1], rgb.shape[0])
    except Exception:
        return None


class VisionCaptureManager:
    """Captures one client-area frame and shares it with all HUD readers."""

    name = "VisionCapture"

    def __init__(
        self, lifecycle: Callable[[], str], calibrate: bool = False,
        capture: VisionCapture | None = None,
        window_provider: Callable[[], GameWindow | None] = find_tft_window,
        ocr: RestrictedHudOcr | None = None, max_fps: float = 3.0,
        root: Path | None = None,
    ) -> None:
        self.lifecycle, self.calibrate = lifecycle, calibrate
        self.capture, self.window_provider, self.ocr = capture or VisionCapture(), window_provider, ocr or RestrictedHudOcr()
        self.max_fps, self.root = max_fps, root or app_data_dir() / "debug" / "vision"
        self.status = "waiting_for_game"
        self.frame: CapturedFrame | None = None
        self.last_capture_at: float | None = None
        self._next_capture = 0.0
        self._sample_hashes: set[str] = set()
        self._sample_count: dict[str, int] = {"gold": 0, "level": 0, "round": 0}

    @property
    def diagnostics(self) -> dict[str, object]:
        frame = self.frame
        return {"status": self.status, "last_capture_at": self.last_capture_at,
                "resolution": f"{frame.width}x{frame.height}" if frame else None,
                "samples": dict(self._sample_count)}

    def poll(self) -> list[TFTEvent]:
        if self.lifecycle() != "game_running":
            self.status, self.frame = "disabled", None
            return []
        now = monotonic()
        if now < self._next_capture:
            return []
        self._next_capture = now + 1.0 / max(1.0, self.max_fps)
        window = self.window_provider()
        if window is None:
            self.status, self.frame = "waiting_for_game", None
            return []
        try:
            self.frame = self.capture.capture(window)
            self.last_capture_at, self.status = time(), ("capturing" if self.calibrate else "ready")
            if self.calibrate:
                self._write_calibration_files()
        except Exception as error:
            self.frame, self.status = None, "unavailable"
            LOGGER.info("[VisionCapture] unavailable: %s", type(error).__name__)
        return []

    def reader(self, field: str, roi: NormalizedRoi) -> Callable[[NormalizedRoi], tuple[object, float] | None]:
        def read(_ignored: NormalizedRoi) -> tuple[object, float] | None:
            frame = self.frame
            if frame is None:
                return None
            rgb, width, height = self._crop(frame, roi)
            if self.calibrate:
                self._save_sample(field, rgb, width, height)
            return self.ocr.read(rgb, width, height)
        return read

    @staticmethod
    def _crop(frame: CapturedFrame, roi: NormalizedRoi) -> tuple[bytes, int, int]:
        left, top, width, height = roi.bounds(frame.width, frame.height)
        rows = bytearray()
        for row in range(top, top + height):
            start = (row * frame.width + left) * 3
            rows.extend(frame.rgb[start:start + width * 3])
        return bytes(rows), width, height

    def _write_calibration_files(self) -> None:
        frame = self.frame
        if frame is None:
            return
        self.root.mkdir(parents=True, exist_ok=True)
        self._save_png(self.root / "frame-latest.png", frame.rgb, frame.width, frame.height)
        regions = (("gold", TFTVisionLayout.GOLD), ("level", TFTVisionLayout.LEVEL), ("round", TFTVisionLayout.ROUND))
        for field, roi in regions:
            rgb, width, height = self._crop(frame, roi)
            self._save_png(self.root / f"{field}-latest.png", rgb, width, height)
        self._save_annotated_layout(regions)

    def _save_annotated_layout(self, regions: tuple[tuple[str, NormalizedRoi], ...]) -> None:
        frame = self.frame
        if frame is None:
            return
        try:
            import cv2
            import numpy as np
            image = np.frombuffer(frame.rgb, dtype=np.uint8).reshape((frame.height, frame.width, 3)).copy()
            for label, roi in regions:
                left, top, width, height = roi.bounds(frame.width, frame.height)
                cv2.rectangle(image, (left, top), (left + width, top + height), (0, 255, 0), 2)
                cv2.putText(image, label.upper(), (left, max(16, top - 4)), cv2.FONT_HERSHEY_SIMPLEX, .55, (0, 255, 0), 1)
            cv2.imwrite(str(self.root / "layout-latest.png"), cv2.cvtColor(image, cv2.COLOR_RGB2BGR))
        except Exception as error:
            LOGGER.debug("[VisionCapture] layout preview failed: %s", type(error).__name__)

    def _save_sample(self, field: str, rgb: bytes, width: int, height: int) -> None:
        if self._sample_count[field] >= 200:
            return
        digest = hashlib.sha256(rgb).hexdigest()
        key = f"{field}:{digest}"
        if key in self._sample_hashes:
            return
        self._sample_hashes.add(key)
        self._sample_count[field] += 1
        directory = self.root / "samples" / field
        directory.mkdir(parents=True, exist_ok=True)
        self._save_png(directory / f"{int(time() * 1000)}_{digest[:8]}.png", rgb, width, height)

    @staticmethod
    def _save_png(path: Path, rgb: bytes, width: int, height: int) -> None:
        import mss.tools
        mss.tools.to_png(rgb, (width, height), output=str(path))


class VisionValueProvider:
    """Throttled vision reader with confidence and temporal-consistency gating."""

    def __init__(self, name: str, event_type: EventType, roi: NormalizedRoi,
                 lifecycle: Callable[[], str], validator: Callable[[object], object | None],
                 reader: Callable[[NormalizedRoi], tuple[object, float] | None] | None = None,
                 interval_seconds: float = 0.5, clock: Callable[[], float] = monotonic) -> None:
        self.name, self.event_type, self.roi = name, event_type, roi
        self.lifecycle, self.validator, self.reader = lifecycle, validator, reader
        self.interval_seconds, self.clock = interval_seconds, clock
        self.status = "calibrating" if reader is None else "waiting_for_game"
        self._next_attempt, self._last_value, self._candidate, self._candidate_count = 0.0, None, None, 0

    def poll(self) -> list[TFTEvent]:
        if self.lifecycle() != "game_running":
            self.status = "disabled"
            return []
        now = self.clock()
        if now < self._next_attempt:
            return []
        self._next_attempt = now + self.interval_seconds
        if self.reader is None:
            self.status = "calibrating"
            return []
        result = self.reader(self.roi)
        if result is None:
            self.status = "calibrating"
            return []
        raw, confidence = result
        value = self.validator(raw)
        if value is None or not 0.0 <= float(confidence) <= 1.0 or float(confidence) < 0.62:
            self.status = "low_confidence"
            return []
        if value == self._candidate:
            self._candidate_count += 1
        else:
            self._candidate, self._candidate_count = value, 1
        if value != self._last_value and float(confidence) < 0.90 and self._candidate_count < 2:
            self.status = "calibrating"
            return []
        self.status = "ready"
        if value == self._last_value:
            return []
        self._last_value = value
        LOGGER.info("[%s] value=%s confidence=%.2f", self.name, value, confidence)
        return [TFTEvent(self.event_type, "VISION", {"value": value}, confidence=float(confidence))]


def vision_level_provider(lifecycle: Callable[[], str], reader: Callable[[NormalizedRoi], tuple[object, float] | None] | None = None) -> VisionValueProvider:
    return VisionValueProvider("VisionLevel", EventType.LEVEL_UPDATED, TFTVisionLayout.LEVEL, lifecycle, lambda value: _integer_value(value) if valid_level(_integer_value(value)) else None, reader, 0.7)


def vision_gold_provider(lifecycle: Callable[[], str], reader: Callable[[NormalizedRoi], tuple[object, float] | None] | None = None) -> VisionValueProvider:
    return VisionValueProvider("VisionGold", EventType.GOLD_UPDATED, TFTVisionLayout.GOLD, lifecycle, lambda value: _integer_value(value) if valid_gold(_integer_value(value)) else None, reader, 0.35)


def vision_round_provider(lifecycle: Callable[[], str], reader: Callable[[NormalizedRoi], tuple[object, float] | None] | None = None) -> VisionValueProvider:
    return VisionValueProvider("VisionRound", EventType.ROUND_UPDATED, TFTVisionLayout.ROUND, lifecycle, lambda value: parse_round(str(value).replace(" ", "")), reader, 0.7)


def _integer_value(value: object) -> int | None:
    if isinstance(value, int):
        return value
    text = str(value).strip()
    return int(text) if text.isascii() and text.isdigit() else None
