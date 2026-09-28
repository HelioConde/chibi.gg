from __future__ import annotations

import logging
from time import monotonic

from PySide6.QtCore import QObject, QThread, QTimer, Signal, Slot

from .client import LcuClient
from .connection import LcuUnavailableError
from .models import GameState, GameStateSnapshot

LOGGER = logging.getLogger("chibi.native.lcu")


def normalize(*, connected: bool, phase: str = "", response: str | None = None, **kwargs: object) -> GameStateSnapshot:
    if not connected:
        state = GameState.CLIENT_OFFLINE
    elif phase in {"", "None", "Lobby"}:
        state = GameState.LOBBY
    elif phase == "Matchmaking":
        state = GameState.MATCHMAKING
    elif phase == "ReadyCheck":
        value = (response or "").casefold()
        state = GameState.READY_CHECK_ACCEPTED if value == "accepted" else GameState.READY_CHECK_DECLINED if value in {"declined", "decline"} else GameState.READY_CHECK
    elif phase in {"ChampSelect", "ChampSelectSession"}:
        state = GameState.PREPARING
    elif phase == "InProgress":
        state = GameState.IN_GAME
    elif phase in {"Reconnect", "Reconnecting"}:
        state = GameState.RECONNECTING
    elif phase in {"PreEndOfGame", "EndOfGame", "PostGame", "WaitingForStats"}:
        state = GameState.POST_GAME
    else:
        state = GameState.UNKNOWN
    return GameStateSnapshot(state=state, connected=connected, raw_phase=phase, player_response=response, **kwargs)


class _Worker(QObject):
    snapshot_ready = Signal(object)

    def __init__(self, interval_ms: int = 1000) -> None:
        super().__init__()
        self.client, self.interval_ms = LcuClient(), interval_ms
        self.timer: QTimer | None = None
        self.stable: GameStateSnapshot | None = None
        self.candidate: GameStateSnapshot | None = None
        self.candidate_at = 0.0

    @Slot()
    def start(self) -> None:
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.poll)
        self.timer.start(self.interval_ms)
        self.poll()

    @Slot()
    def poll(self) -> None:
        try:
            player = self.client.player()
            phase = self.client.phase()
            session = self.client.session()
            response = self.client.ready_response() if phase == "ReadyCheck" else None
            snapshot = normalize(connected=True, phase=phase, response=response, riot_id=player.riot_id, player_puuid=player.puuid, queue_id=session.queue_id if session else None, queue_name=session.queue_name if session else "", details={"game_mode": session.game_mode if session else "", "is_ranked": session.is_ranked if session else False, "player_count": session.player_count if session else 0})
        except LcuUnavailableError:
            snapshot = GameStateSnapshot.offline()
        self._publish_stable(snapshot)

    def _publish_stable(self, snapshot: GameStateSnapshot) -> None:
        if self.stable is None or snapshot.transition_key == self.stable.transition_key:
            if self.stable is None:
                self._publish(snapshot)
            return
        if snapshot.state in {GameState.READY_CHECK, GameState.READY_CHECK_ACCEPTED, GameState.READY_CHECK_DECLINED}:
            self._publish(snapshot)
        elif self.candidate is None or self.candidate.transition_key != snapshot.transition_key:
            self.candidate, self.candidate_at = snapshot, monotonic()
        elif monotonic() - self.candidate_at >= 0.35:
            self._publish(snapshot)

    def _publish(self, snapshot: GameStateSnapshot) -> None:
        if self.stable is None or self.stable.state != snapshot.state:
            LOGGER.info("[LCU] %s", snapshot.state.value)
        self.stable, self.candidate = snapshot, None
        self.snapshot_ready.emit(snapshot)


class GameflowMonitor(QObject):
    state_changed = Signal(object)

    def __init__(self, interval_ms: int = 1000) -> None:
        super().__init__()
        self.thread, self.worker = QThread(self), _Worker(interval_ms)
        self.worker.moveToThread(self.thread)
        self.thread.started.connect(self.worker.start)
        self.worker.snapshot_ready.connect(self.state_changed)
        self.thread.finished.connect(self.worker.deleteLater)

    def start(self) -> None:
        if not self.thread.isRunning(): self.thread.start()

    def stop(self) -> None:
        if self.thread.isRunning():
            self.thread.quit()
            self.thread.wait(2500)


class DemoGameflowMonitor(QObject):
    state_changed = Signal(object)
    states = (GameState.LOBBY, GameState.MATCHMAKING, GameState.READY_CHECK, GameState.READY_CHECK_ACCEPTED, GameState.PREPARING, GameState.IN_GAME, GameState.POST_GAME)

    def __init__(self) -> None:
        super().__init__(); self.index = 0

    def start(self) -> None: self.emit_state()
    def stop(self) -> None: pass
    def advance(self) -> None: self.index = (self.index + 1) % len(self.states); self.emit_state()
    def emit_state(self) -> None:
        state = self.states[self.index]
        phase = {GameState.LOBBY: "Lobby", GameState.MATCHMAKING: "Matchmaking", GameState.READY_CHECK: "ReadyCheck", GameState.READY_CHECK_ACCEPTED: "ReadyCheck", GameState.PREPARING: "ChampSelect", GameState.IN_GAME: "InProgress", GameState.POST_GAME: "EndOfGame"}[state]
        self.state_changed.emit(normalize(connected=True, phase=phase, response="Accepted" if state is GameState.READY_CHECK_ACCEPTED else None, riot_id="Demo#CHIBI", player_puuid="demo", queue_id=1100, queue_name="TFT", details={"game_mode": "TFT", "is_ranked": True, "player_count": 8}))
