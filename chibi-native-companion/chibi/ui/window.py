from __future__ import annotations
from PySide6.QtWidgets import QLabel, QMainWindow, QVBoxLayout, QWidget
from chibi.riot.lcu.models import GameStateSnapshot
from .status import PRESENTATION

class CompanionWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__(); self.setWindowTitle("Chibi Companion"); self.setMinimumSize(320, 210)
        root = QWidget(); layout = QVBoxLayout(root)
        self.title, self.riot, self.status, self.detail, self.focus = QLabel("CHIBI COMPANION"), QLabel("Riot · Offline"), QLabel(), QLabel(), QLabel("Foco da sessão · Flexibilidade")
        for widget in (self.title, self.riot, self.status, self.detail, self.focus): layout.addWidget(widget)
        self.setCentralWidget(root)
    def update_gameflow(self, snapshot: GameStateSnapshot) -> None:
        title, description = PRESENTATION[snapshot.state]
        self.riot.setText("Riot · Conectado" if snapshot.connected else "Riot · Offline")
        self.status.setText(title); self.detail.setText(description)
        if snapshot.riot_id: self.title.setText(f"CHIBI COMPANION\n{snapshot.riot_id}")
