import os

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PySide6.QtWidgets import QApplication

from chibi.plan import GamePlan
from chibi.riot.lcu.gameflow import normalize
from chibi.ui.window import CompanionWindow


def test_in_game_window_shows_plan_and_expands_selector(monkeypatch):
    monkeypatch.setattr(CompanionWindow, "_load_assets", lambda self: None)
    monkeypatch.setattr(CompanionWindow, "_load_comps", lambda self: None)
    app = QApplication.instance() or QApplication([])
    window = CompanionWindow()
    window.show()
    window.set_game_plan(GamePlan(
        primary_comp="Plano de teste",
        carries=["TFT13_Warwick"],
        frontline=["TFT13_RekSai"],
        traits=["TFT13_Bruiser"],
        carry_items=["TFT_Item_GuinsoosRageblade"],
    ))
    window.update_gameflow(normalize(connected=True, phase="InProgress"))
    assert window.status.text() == "EM PARTIDA"
    assert not window.plan_button.isHidden()
    window.show_selector()
    assert not window.content.isHidden()
    assert window.content.currentWidget() is window.selector
    window.hide()
    app.processEvents()
