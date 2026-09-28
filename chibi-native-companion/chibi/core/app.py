from __future__ import annotations
import argparse
import sys
from time import time
from PySide6.QtCore import QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import QApplication
from chibi.core.context import CompanionContext
from chibi.core.events import EventBus
from chibi.core.logging import configure
from chibi.debug.reports import telemetry_report
from chibi.debug.inspector import investigate
from chibi.riot.game.detector import GameProcessDetector
from chibi.riot.lcu.gameflow import DemoGameflowMonitor, GameflowMonitor
from chibi.riot.lcu.client import LcuClient
from chibi.riot.lcu.connection import LcuUnavailableError
from chibi.session.manager import SessionManager
from chibi.session.models import SessionState
from chibi.session.postgame import PostGameController
from chibi.navigation import build_analysis_url
from chibi.telemetry.manager import TelemetryManager
from chibi.ui.tray import create_tray
from chibi.ui.window import CompanionWindow

def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--demo", action="store_true"); parser.add_argument("--debug", action="store_true"); parser.add_argument("--telemetry-report", action="store_true"); parser.add_argument("--discover-game", action="store_true"); parser.add_argument("--investigate", action="store_true"); args = parser.parse_args()
    configure(args.debug); telemetry = TelemetryManager().poll()
    if args.telemetry_report: print(telemetry_report(telemetry)); return 0
    if args.discover_game: print(GameProcessDetector().record_diff()); return 0
    if args.investigate:
        try: connected = bool(LcuClient().phase())
        except LcuUnavailableError: connected = False
        print(investigate(connected)); return 0
    app = QApplication(sys.argv); app.setApplicationName("Chibi Native Companion")
    context, bus, sessions, window = CompanionContext(telemetry=telemetry), EventBus(), SessionManager(), CompanionWindow()
    postgame = PostGameController()
    captured_sessions: set[str] = set()
    def show_analysis(session: object, result: object) -> None:
        riot_id = getattr(session, "riot_id", "")
        game_name, _, tag_line = riot_id.partition("#")
        QDesktopServices.openUrl(QUrl(build_analysis_url(
            game_name, tag_line, getattr(session, "platform", "br1"),
            getattr(session, "match_id", ""), getattr(session, "focus_id", ""),
        )))
    postgame.completed.connect(lambda _session, result: window.show_result(result))
    window.open_analysis.clicked.connect(lambda: show_analysis(sessions.current, None) if sessions.current else None)
    def update(snapshot: object) -> None:
        context.gameflow = snapshot  # type: ignore[assignment]
        session = sessions.on_gameflow(snapshot)  # type: ignore[arg-type]
        if session and getattr(snapshot, "state", None).value == "in_game" and session.id not in captured_sessions:
            captured_sessions.add(session.id); postgame.capture_pre_game(session)
        if session and session.state is SessionState.WAITING_RESULT:
            postgame.resolve(session)
        window.update_gameflow(snapshot)  # type: ignore[arg-type]
        bus.publish("gameflow", snapshot)
    monitor = DemoGameflowMonitor() if args.demo else GameflowMonitor(); monitor.state_changed.connect(update); monitor.start()
    tray = create_tray(window.show, window.hide, app.quit); app.aboutToQuit.connect(monitor.stop); app.aboutToQuit.connect(postgame.stop)
    if sessions.current and sessions.current.is_waiting and sessions.current.game_ended_at and time() - sessions.current.game_ended_at < 210:
        postgame.resolve(sessions.current)
    window.show(); return app.exec()
