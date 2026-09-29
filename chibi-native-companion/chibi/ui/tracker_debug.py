from __future__ import annotations

from time import time

from PySide6.QtWidgets import QPlainTextEdit, QVBoxLayout, QWidget


class TrackerDebugPanel(QWidget):
    """Local-only state inspector; it never sends tracker data anywhere."""

    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("Chibi Tracker Debug")
        self.setMinimumSize(460, 520)
        self.output = QPlainTextEdit()
        self.output.setReadOnly(True)
        layout = QVBoxLayout(self)
        layout.addWidget(self.output)

    def update_state(self, state: object) -> None:
        player = getattr(state, "player", None)
        now = time()
        hp = getattr(player, "hp", None)
        level = getattr(player, "level", None)
        gold = getattr(player, "gold", None)
        round_value = getattr(state, "round", None)
        board = getattr(state, "board", [])
        purchases = getattr(state, "purchases", [])[-5:]
        stars = getattr(state, "star_ups", [])[-5:]
        lines = [
            f"Game Phase: {getattr(state, 'lifecycle', 'unknown')}",
            f"Heartbeat phase: {getattr(state, 'heartbeat_phase', None) or '—'} · TFT PID: {getattr(state, 'tft_pid', None) or '—'}",
            f"Game ID: {getattr(state, 'game_id', None) or '—'}",
            _observation("HP", hp, now),
            _observation("Level", level, now),
            _observation("Gold", gold, now),
            _observation("Round", round_value, now),
            f"Checkpoint age: {_checkpoint_age(getattr(state, 'checkpoint_at', None), now)}",
            f"Rerolls: {getattr(state, 'rerolls', 0)} · XP purchases: {getattr(state, 'xp_purchases', 0)}",
            "", "Board:",
        ]
        lines.extend(
            f"{getattr(piece, 'display_name', None) or piece.champion_id or piece.raw_id} "
            f"{'★' * (piece.stars or 0)} · {', '.join(piece.items) or 'sem itens'}"
            f"\n  raw: {piece.raw_id} · resolved: {'yes' if piece.resolved else 'no'}"
            for piece in board
        )
        lines.extend(["", "Recent purchases:"])
        lines.extend(str(row.get("championId") or row.get("rawId") or "—") for row in purchases)
        lines.extend(["", "Recent star ups:"])
        lines.extend(f"{row.get('championId') or '—'} → {row.get('stars') or '—'}★" for row in stars)
        vision = getattr(state, "vision", {})
        if isinstance(vision, dict):
            lines.extend(["", "VISION"])
            lines.append(f"Capture: {vision.get('status', '—')} · resolution: {vision.get('resolution') or '—'} · age: {_age(vision.get('last_capture_at'), now)}")
            samples = vision.get("samples")
            if isinstance(samples, dict):
                lines.append("Samples: " + " · ".join(f"{key}={value}" for key, value in samples.items()))
        lines.extend(["", "Providers:"])
        lines.extend(f"{name}: {status}" for name, status in getattr(state, "providers", {}).items())
        self.output.setPlainText("\n".join(lines))


def _age(timestamp: object, now: float) -> str:
    if not isinstance(timestamp, (int, float)) or timestamp <= 0:
        return "—"
    return f"{max(0.0, now - timestamp):.1f}s"


def _observation(label: str, observed: object, now: float) -> str:
    value = getattr(observed, "value", None)
    source = getattr(observed, "source", "unknown")
    confidence = getattr(observed, "confidence", 0.0)
    observed_at = getattr(observed, "observed_at", None)
    return (
        f"{label}: {value if value is not None else '—'} "
        f"· source: {source} · confidence: {confidence:.2f} · age: {_age(observed_at, now)}"
    )


def _checkpoint_age(timestamp: object, now: float) -> str:
    age = _age(timestamp, now)
    if age == "—":
        return age
    seconds = max(0.0, now - float(timestamp))
    label = "normal" if seconds < 30 else "stale" if seconds <= 90 else "warning"
    return f"{age} · {label}"
