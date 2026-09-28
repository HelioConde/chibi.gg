from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QFrame, QHBoxLayout, QLabel, QVBoxLayout

from chibi_overlay.riot.models import GameStateSnapshot, PRESENTATIONS


class GameStatusCard(QFrame):
    """Small visual projection of a normalized gameflow state."""

    def __init__(self) -> None:
        super().__init__()
        self.setObjectName("gameStatusCard")
        layout = QHBoxLayout(self)
        layout.setContentsMargins(10, 8, 10, 8)
        layout.setSpacing(8)
        self.icon = QLabel("○")
        self.icon.setObjectName("gameStatusIcon")
        self.icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(self.icon)
        text = QVBoxLayout()
        text.setSpacing(1)
        self.title = QLabel("CLIENTE RIOT OFFLINE")
        self.title.setObjectName("gameStatusTitle")
        self.description = QLabel("Abra o cliente Riot para conectar.")
        self.description.setObjectName("gameStatusDescription")
        text.addWidget(self.title)
        text.addWidget(self.description)
        layout.addLayout(text, 1)
        self.indicator = QLabel("●")
        self.indicator.setObjectName("gameStatusIndicator")
        layout.addWidget(self.indicator)

    def set_snapshot(self, snapshot: GameStateSnapshot) -> None:
        presentation = PRESENTATIONS[snapshot.state]
        self.icon.setText(presentation.icon)
        self.title.setText(presentation.title)
        self.description.setText(presentation.description)
        self.setProperty("tone", presentation.tone)
        self.style().unpolish(self)
        self.style().polish(self)

