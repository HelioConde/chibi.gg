from __future__ import annotations
import argparse
import sys
from pathlib import Path
from time import time
from PySide6.QtCore import QLockFile, QTimer, QUrl
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
from chibi.plan import GamePlanStore
from chibi.core.settings import app_data_dir
from chibi.vision.debug import vision_debug_report
from chibi.vision.pending import create_pending, label_pending
from chibi.tracker.vision import recognize_saved_roi
from chibi.tracker.monitor import TFTTrackerMonitor
from chibi.ui.tracker_debug import TrackerDebugPanel
from chibi.recording.recorder import MatchSessionRecorder
from chibi.recording.upload import PostGameUploadQueue
from chibi.auth.secure_store import SecureTokenStore
from chibi.auth.client import ChibiAuthClient, SessionProvider

def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--demo", action="store_true"); parser.add_argument("--debug", action="store_true"); parser.add_argument("--tracker-debug", action="store_true"); parser.add_argument("--vision-calibrate", action="store_true"); parser.add_argument("--vision-test", type=Path, metavar="ROI_PNG"); parser.add_argument("--telemetry-report", action="store_true"); parser.add_argument("--discover-game", action="store_true"); parser.add_argument("--investigate", action="store_true"); parser.add_argument("--vision-debug", action="store_true"); parser.add_argument("--vision-capture-field", choices=("gold","level","stage")); parser.add_argument("--vision-label",nargs=2,metavar=("SAMPLE_ID","LABEL")); parser.add_argument("--import-plan"); args = parser.parse_args()
    configure(args.debug); telemetry = TelemetryManager().poll()
    if args.telemetry_report: print(telemetry_report(telemetry)); return 0
    if args.discover_game: print(GameProcessDetector().record_diff()); return 0
    if args.investigate:
        try: connected = bool(LcuClient().phase())
        except LcuUnavailableError: connected = False
        print(investigate(connected)); return 0
    plans=GamePlanStore()
    if args.import_plan: print(plans.import_file(Path(args.import_plan))); return 0
    if args.vision_debug: print(vision_debug_report()); return 0
    if args.vision_capture_field: print(create_pending(args.vision_capture_field,str(app_data_dir()/"debug"/"vision"/(args.vision_capture_field+"-region.png")))); return 0
    if args.vision_label: print(label_pending(*args.vision_label)); return 0
    if args.vision_test: print(recognize_saved_roi(args.vision_test)); return 0
    app = QApplication(sys.argv); app.setApplicationName("Chibi Native Companion")
    instance_lock = QLockFile(str(app_data_dir() / "chibi-native.lock"))
    instance_lock.setStaleLockTime(0)
    if not instance_lock.tryLock(1):
        return 0
    token_store = SecureTokenStore()
    auth_client = ChibiAuthClient()
    session_provider = SessionProvider(token_store, auth_client)
    context, bus, sessions = CompanionContext(telemetry=telemetry), EventBus(), SessionManager()
    window = CompanionWindow(plans, token_store)
    window.set_debug(args.debug); window.set_game_plan(plans.load()); window.set_live_telemetry(telemetry)
    postgame = PostGameController()
    tracker = TFTTrackerMonitor(vision_calibrate=args.vision_calibrate)
    recorder = MatchSessionRecorder()
    upload_queue = PostGameUploadQueue(recorder.root, session_provider)
    debug_panel = TrackerDebugPanel() if args.tracker_debug else None
    if debug_panel: debug_panel.show()
    tracker_finalize_pending = {"scheduled": False}

    def finalize_from_tracker() -> None:
        tracker_finalize_pending["scheduled"] = False
        state = context.tracker
        if state is None or recorder.status.state != "recording":
            return
        if getattr(state, "lifecycle", "") == "game_running":
            return
        recorder.finalize(state)
        QTimer.singleShot(250, poll_upload)

    def update_tracker(state: object) -> None:
        context.tracker = state
        lifecycle = getattr(state, "lifecycle", "")
        if lifecycle == "game_running" and recorder.status.state != "recording":
            recorder.start(context.gameflow, fallback=state)
            recorder.set_upload_status("locked_until_game_end")
        elif lifecycle != "game_running" and recorder.status.state == "recording" and not tracker_finalize_pending["scheduled"]:
            tracker_finalize_pending["scheduled"] = True
            QTimer.singleShot(6000, finalize_from_tracker)
        recorder.snapshot(state)
        setattr(state, "recorder", recorder.status)
        bus.publish("tracker_state", state)
        if debug_panel: debug_panel.update_state(state)
    tracker.state_changed.connect(update_tracker)
    def record_event(event: object) -> None:
        recorder.event(event, tracker.reducer.state)  # type: ignore[arg-type]
        bus.publish("tft_event", event)
    tracker.event_emitted.connect(record_event)
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

    def poll_upload() -> None:
        phase = getattr(getattr(context.gameflow, "state", None), "value", "")
        if phase == "in_game":
            recorder.set_upload_status("locked_until_game_end")
            return
        upload_queue.poll()
        recorder.set_upload_status(upload_queue.status)
        if debug_panel and context.tracker is not None:
            setattr(context.tracker, "recorder", recorder.status)
            debug_panel.update_state(context.tracker)

    upload_timer = QTimer()
    upload_timer.setInterval(5000)
    upload_timer.timeout.connect(poll_upload)
    upload_timer.start()

    def update(snapshot: object) -> None:
        context.gameflow = snapshot  # type: ignore[assignment]
        state=getattr(snapshot,"state",None)
        if getattr(state,"value","")=="in_game":
            recorder.start(snapshot, fallback=tracker.reducer.state)
            recorder.set_upload_status("locked_until_game_end")
        elif recorder.status.state=="recording" and getattr(state,"value","") in {"post_game","lobby","client_offline"}:
            recorder.finalize(tracker.reducer.state)
            QTimer.singleShot(250, poll_upload)
        tracker.set_puuid(getattr(snapshot, "player_puuid", ""))
        session = sessions.on_gameflow(snapshot)  # type: ignore[arg-type]
        if session and getattr(snapshot, "state", None).value == "in_game" and session.id not in captured_sessions:
            captured_sessions.add(session.id); postgame.capture_pre_game(session)
        if session and session.state is SessionState.WAITING_RESULT:
            postgame.resolve(session)
        window.update_gameflow(snapshot)  # type: ignore[arg-type]
        bus.publish("gameflow", snapshot)
    monitor = DemoGameflowMonitor() if args.demo else GameflowMonitor(); monitor.state_changed.connect(update); monitor.start()
    tracker.start()
    tray = create_tray(window, app.quit); app.aboutToQuit.connect(upload_timer.stop); app.aboutToQuit.connect(monitor.stop); app.aboutToQuit.connect(tracker.stop); app.aboutToQuit.connect(postgame.stop); app.aboutToQuit.connect(instance_lock.unlock)
    if sessions.current and sessions.current.is_waiting and sessions.current.game_ended_at and time() - sessions.current.game_ended_at < 210:
        postgame.resolve(sessions.current)
    window.show(); return app.exec()
