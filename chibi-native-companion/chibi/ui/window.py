from __future__ import annotations
from PySide6.QtWidgets import QLabel, QMainWindow, QPushButton, QTabWidget, QVBoxLayout, QWidget
from chibi.plan import GamePlan
from chibi.riot.lcu.models import GameStateSnapshot
from .status import PRESENTATION

class CompanionWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__(); self.setWindowTitle("Chibi Companion"); self.setMinimumSize(320, 210)
        root = QWidget(); layout = QVBoxLayout(root)
        self.title, self.riot, self.status, self.detail, self.focus = QLabel("CHIBI COMPANION"), QLabel("Riot · Offline"), QLabel(), QLabel(), QLabel("Foco da sessão · Flexibilidade")
        self.result = QLabel(); self.open_analysis = QPushButton("ABRIR ANÁLISE"); self.result.hide(); self.open_analysis.hide()
        self.plan_button=QPushButton("PLANO"); self.plan_tabs=QTabWidget(); self.plan_tabs.hide()
        self.plan_labels={name:QLabel() for name in ("PLANO","UNIDADES","ITENS","TRAITS")}
        for name,label in self.plan_labels.items(): self.plan_tabs.addTab(label,name)
        self.plan_button.clicked.connect(lambda:self.plan_tabs.setVisible(not self.plan_tabs.isVisible()))
        for widget in (self.title, self.riot, self.status, self.detail, self.focus, self.plan_button, self.plan_tabs, self.result, self.open_analysis): layout.addWidget(widget)
        self.setCentralWidget(root)
    def update_gameflow(self, snapshot: GameStateSnapshot) -> None:
        title, description = PRESENTATION[snapshot.state]
        self.riot.setText("Riot · Conectado" if snapshot.connected else "Riot · Offline")
        self.status.setText(title); self.detail.setText(description)
        self.plan_button.setVisible(snapshot.state.value=="in_game")
        if snapshot.state.value!="in_game": self.plan_tabs.hide()
        if snapshot.state.value != "post_game": self.result.hide(); self.open_analysis.hide()
        if snapshot.riot_id: self.title.setText(f"CHIBI COMPANION\n{snapshot.riot_id}")

    def show_result(self, result: object) -> None:
        placement, level = getattr(result, "placement", "—"), getattr(result, "level", "—")
        damage, eliminations = getattr(result, "damage_to_players", "—"), getattr(result, "players_eliminated", "—")
        self.status.setText("PARTIDA FINALIZADA")
        self.detail.setText(f"{placement}º lugar · Nível final {level}")
        self.result.setText(f"Dano a jogadores: {damage} · Eliminações: {eliminations}")
        self.result.show(); self.open_analysis.show()

    def set_game_plan(self, plan: GamePlan) -> None:
        self.focus.setText("Foco · "+plan.session_focus)
        self.plan_labels["PLANO"].setText("COMPOSIÇÃO\n"+(plan.primary_comp or "Nenhuma composição selecionada")+"\n\n"+"\n".join(plan.level_plan+plan.roll_plan))
        self.plan_labels["UNIDADES"].setText("Core\n"+" · ".join(plan.core_units or plan.carries+plan.frontline or ["Importe um plano para ver unidades."]))
        self.plan_labels["ITENS"].setText("Carry: "+" · ".join(plan.carry_items or ["—"])+"\nTank: "+" · ".join(plan.tank_items or ["—"]))
        self.plan_labels["TRAITS"].setText(" · ".join(plan.traits or ["—"]))
