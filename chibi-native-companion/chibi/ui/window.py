from __future__ import annotations
from PySide6.QtWidgets import QLabel, QMainWindow, QPushButton, QVBoxLayout, QWidget
from chibi.riot.lcu.models import GameStateSnapshot
from .status import PRESENTATION

class CompanionWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__(); self.setWindowTitle("Chibi Companion"); self.setMinimumSize(320, 210)
        root = QWidget(); layout = QVBoxLayout(root)
        self.title, self.riot, self.status, self.detail, self.focus = QLabel("CHIBI COMPANION"), QLabel("Riot · Offline"), QLabel(), QLabel(), QLabel("Foco da sessão · Flexibilidade")
        self.result = QLabel(); self.open_analysis = QPushButton("ABRIR ANÁLISE"); self.result.hide(); self.open_analysis.hide()
        for widget in (self.title, self.riot, self.status, self.detail, self.focus, self.result, self.open_analysis): layout.addWidget(widget)
        self.setCentralWidget(root)
    def update_gameflow(self, snapshot: GameStateSnapshot) -> None:
        title, description = PRESENTATION[snapshot.state]
        self.riot.setText("Riot · Conectado" if snapshot.connected else "Riot · Offline")
        self.status.setText(title); self.detail.setText(description)
        if snapshot.state.value != "post_game": self.result.hide(); self.open_analysis.hide()
        if snapshot.riot_id: self.title.setText(f"CHIBI COMPANION\n{snapshot.riot_id}")

    def show_result(self, result: object) -> None:
        placement, level = getattr(result, "placement", "—"), getattr(result, "level", "—")
        damage, eliminations = getattr(result, "damage_to_players", "—"), getattr(result, "players_eliminated", "—")
        self.status.setText("PARTIDA FINALIZADA")
        self.detail.setText(f"{placement}º lugar · Nível final {level}")
        self.result.setText(f"Dano a jogadores: {damage} · Eliminações: {eliminations}")
        self.result.show(); self.open_analysis.show()
