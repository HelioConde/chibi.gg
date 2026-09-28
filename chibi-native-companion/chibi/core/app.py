from __future__ import annotations
import argparse
import sys
from PySide6.QtWidgets import QApplication
from chibi.core.context import CompanionContext
from chibi.core.events import EventBus
from chibi.core.logging import configure
from chibi.debug.reports import telemetry_report
from chibi.riot.lcu.gameflow import DemoGameflowMonitor, GameflowMonitor
from chibi.session.manager import SessionManager
from chibi.telemetry.manager import TelemetryManager
from chibi.ui.tray import create_tray
from chibi.ui.window import CompanionWindow

def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--demo", action="store_true"); parser.add_argument("--debug", action="store_true"); parser.add_argument("--telemetry-report", action="store_true"); args = parser.parse_args()
    configure(args.debug); telemetry = TelemetryManager().poll()
    if args.telemetry_report: print(telemetry_report(telemetry)); return 0
    app = QApplication(sys.argv); app.setApplicationName("Chibi Native Companion")
    context, bus, sessions, window = CompanionContext(telemetry=telemetry), EventBus(), SessionManager(), CompanionWindow()
    def update(snapshot: object) -> None:
        context.gameflow = snapshot  # type: ignore[assignment]
        sessions.on_gameflow(snapshot)  # type: ignore[arg-type]
        window.update_gameflow(snapshot)  # type: ignore[arg-type]
        bus.publish("gameflow", snapshot)
    monitor = DemoGameflowMonitor() if args.demo else GameflowMonitor(); monitor.state_changed.connect(update); monitor.start()
    tray = create_tray(window.show, window.hide, app.quit); app.aboutToQuit.connect(monitor.stop)
    window.show(); return app.exec()
