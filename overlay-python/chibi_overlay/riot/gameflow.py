from __future__ import annotations

import logging
from time import monotonic

from PySide6.QtCore import QObject, QThread, QTimer, Signal, Slot

from .client import LcuClient
from .connection import LcuUnavailableError
from .models import GameState, GameStateSnapshot

LOGGER = logging.getLogger("chibi.riot")


def normalize_gameflow(
    *,
    connected: bool,
    phase: str = "",
    player_response: str | None = None,
    queue_id: int | None = None,
    queue_name: str = "",
    riot_id: str = "",
    details: dict[str, object] | None = None,
) -> GameStateSnapshot:
    """Translate raw LCU values to the one state model consumed by the UI."""
    if not connected:
        state = GameState.CLIENT_OFFLINE
    elif phase in {"", "None", "Lobby"}:
        state = GameState.LOBBY
    elif phase == "Matchmaking":
        state = GameState.MATCHMAKING
    elif phase == "ReadyCheck":
        response = (player_response or "").casefold()
        if response == "accepted":
            state = GameState.READY_CHECK_ACCEPTED
        elif response in {"declined", "decline"}:
            state = GameState.READY_CHECK_DECLINED
        else:
            state = GameState.READY_CHECK
    elif phase in {"ChampSelect", "ChampSelectSession"}:
        state = GameState.CHAMP_SELECT
    elif phase == "InProgress":
        state = GameState.IN_GAME
    else:
        state = GameState.UNKNOWN
    return GameStateSnapshot(
        state=state,
        raw_phase=phase,
        player_response=player_response,
        queue_id=queue_id,
        queue_name=queue_name,
        connected=connected,
        riot_id=riot_id,
        details=details or {},
    )


class _GameflowWorker(QObject):
    snapshot_ready = Signal(object)

    def __init__(self, interval_ms: int = 1000) -> None:
        super().__init__()
        self.interval_ms = interval_ms
        self.client = LcuClient()
        self.timer: QTimer | None = None
        self._stable: GameStateSnapshot | None = None
        self._candidate: GameStateSnapshot | None = None
        self._candidate_since = 0.0

    @Slot()
    def start(self) -> None:
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.poll)
        self.timer.start(self.interval_ms)
        self.poll()

    @Slot()
    def stop(self) -> None:
        if self.timer:
            self.timer.stop()

    @Slot()
    def poll(self) -> None:
        try:
            player = self.client.current_player()
            phase = self.client.gameflow_phase()
            session = self.client.gameflow_session()
            response = self.client.ready_check_response() if phase == "ReadyCheck" else None
            snapshot = normalize_gameflow(
                connected=True,
                phase=phase,
                player_response=response,
                queue_id=session.queue_id if session else None,
                queue_name=session.queue_name if session else "",
                riot_id=player.riot_id,
                details={
                    "game_mode": session.game_mode if session else "",
                    "player_count": session.player_count if session else 0,
                    "is_ranked": session.is_ranked if session else False,
                },
            )
        except LcuUnavailableError:
            snapshot = normalize_gameflow(connected=False)
        self._publish_when_stable(snapshot)

    def _publish_when_stable(self, snapshot: GameStateSnapshot) -> None:
        if self._stable is None:
            self._publish(snapshot)
            return
        if snapshot.transition_key == self._stable.transition_key:
            self._candidate = None
            return
        immediate = snapshot.state in {
            GameState.READY_CHECK,
            GameState.READY_CHECK_ACCEPTED,
            GameState.READY_CHECK_DECLINED,
        }
        if immediate:
            self._publish(snapshot)
            return
        if self._candidate is None or snapshot.transition_key != self._candidate.transition_key:
            self._candidate = snapshot
            self._candidate_since = monotonic()
            return
        if monotonic() - self._candidate_since >= 0.35:
            self._publish(snapshot)

    def _publish(self, snapshot: GameStateSnapshot) -> None:
        previous = self._stable
        self._stable = snapshot
        self._candidate = None
        if previous is None:
            LOGGER.info("[LCU] connected=%s phase %s", snapshot.connected, snapshot.raw_phase or "offline")
        else:
            LOGGER.info("[LCU] %s -> %s", previous.state.value, snapshot.state.value)
        self.snapshot_ready.emit(snapshot)


class GameflowMonitor(QObject):
    """Threaded, read-only publisher of normalized Riot gameflow snapshots."""

    state_changed = Signal(object)

    def __init__(self, interval_ms: int = 1000, parent: QObject | None = None) -> None:
        super().__init__(parent)
        self.thread = QThread(self)
        self.worker = _GameflowWorker(interval_ms)
        self.worker.moveToThread(self.thread)
        self.thread.started.connect(self.worker.start)
        self.worker.snapshot_ready.connect(self.state_changed)
        self.thread.finished.connect(self.worker.deleteLater)

    def start(self) -> None:
        if not self.thread.isRunning():
            self.thread.start()

    def stop(self) -> None:
        if not self.thread.isRunning():
            return
        self.thread.quit()
        self.thread.wait(2500)


class DemoGameflowMonitor(QObject):
    """Offline demo source. Ctrl+Shift+D advances states without a Riot client."""

    state_changed = Signal(object)

    def __init__(self, parent: QObject | None = None) -> None:
        super().__init__(parent)
        self.states = [
            GameState.LOBBY,
            GameState.MATCHMAKING,
            GameState.READY_CHECK,
            GameState.READY_CHECK_ACCEPTED,
            GameState.CHAMP_SELECT,
            GameState.IN_GAME,
        ]
        self.index = 0

    def start(self) -> None:
        self._emit()

    def stop(self) -> None:
        pass

    def advance_demo(self) -> None:
        self.index = (self.index + 1) % len(self.states)
        self._emit()

    def _emit(self) -> None:
        state = self.states[self.index]
        phase = {
            GameState.LOBBY: "Lobby",
            GameState.MATCHMAKING: "Matchmaking",
            GameState.READY_CHECK: "ReadyCheck",
            GameState.READY_CHECK_ACCEPTED: "ReadyCheck",
            GameState.CHAMP_SELECT: "ChampSelect",
            GameState.IN_GAME: "InProgress",
        }[state]
        response = "Accepted" if state is GameState.READY_CHECK_ACCEPTED else None
        self.state_changed.emit(
            normalize_gameflow(
                connected=True,
                phase=phase,
                player_response=response,
                queue_id=1100,
                queue_name="Teamfight Tactics (ranqueada)",
                riot_id="Demo#CHIBI",
                details={"game_mode": "TFT", "player_count": 8, "is_ranked": True},
            )
        )
