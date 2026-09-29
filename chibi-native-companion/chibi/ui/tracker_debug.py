from __future__ import annotations

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
        hp = getattr(getattr(player, "hp", None), "value", None)
        board = getattr(state, "board", [])
        purchases = getattr(state, "purchases", [])[-5:]
        stars = getattr(state, "star_ups", [])[-5:]
        lines = [
            f"Game Phase: {getattr(state, 'lifecycle', 'unknown')}",
            f"Heartbeat phase: {getattr(state, 'heartbeat_phase', None) or '—'} · TFT PID: {getattr(state, 'tft_pid', None) or '—'}",
            f"Game ID: {getattr(state, 'game_id', None) or '—'}",
            f"HP: {hp if hp is not None else '—'}",
            f"Checkpoint: {getattr(state, 'checkpoint_at', None) or '—'}",
            f"Rerolls: {getattr(state, 'rerolls', 0)} · XP purchases: {getattr(state, 'xp_purchases', 0)}",
            "", "Board:",
        ]
        lines.extend(f"{piece.champion_id} {'★' * (piece.stars or 0)} · {', '.join(piece.items) or 'sem itens'}" for piece in board)
        lines.extend(["", "Recent purchases:"])
        lines.extend(str(row.get("championId") or row.get("rawId") or "—") for row in purchases)
        lines.extend(["", "Recent star ups:"])
        lines.extend(f"{row.get('championId') or '—'} → {row.get('stars') or '—'}★" for row in stars)
        lines.extend(["", "Providers:"])
        lines.extend(f"{name}: {status}" for name, status in getattr(state, "providers", {}).items())
        self.output.setPlainText("\n".join(lines))
