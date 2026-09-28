from __future__ import annotations

from time import time
from uuid import uuid4
from chibi.riot.lcu.models import GameState, GameStateSnapshot
from .focus import FOCUSES, SessionFocus
from .models import ChibiSession, SessionState
from .storage import SessionStorage

class SessionManager:
    def __init__(self, focus: SessionFocus | None = None, storage: SessionStorage | None = None) -> None:
        self.focus = focus or FOCUSES[2]
        self.storage = storage or SessionStorage()
        self.current = self.storage.load_waiting()
    def set_focus(self, focus: SessionFocus) -> None: self.focus = focus
    def on_gameflow(self, snapshot: GameStateSnapshot) -> ChibiSession | None:
        if snapshot.state in {GameState.MATCHMAKING, GameState.IN_GAME} and (self.current is None or self.current.state in {SessionState.COMPLETED, SessionState.ABORTED}):
            self.current = ChibiSession(
                id=str(uuid4()), riot_id=snapshot.riot_id, focus_id=self.focus.id,
                state=SessionState.QUEUEING if snapshot.state is GameState.MATCHMAKING else SessionState.IN_GAME,
                queue_id=snapshot.queue_id,
            )
            if snapshot.state is GameState.IN_GAME: self.current.game_started_at = snapshot.timestamp or time()
            self.storage.save(self.current)
        if not self.current: return None
        target = {GameState.MATCHMAKING: SessionState.QUEUEING, GameState.READY_CHECK: SessionState.READY, GameState.READY_CHECK_ACCEPTED: SessionState.STARTING, GameState.PREPARING: SessionState.STARTING, GameState.IN_GAME: SessionState.IN_GAME, GameState.POST_GAME: SessionState.WAITING_RESULT}.get(snapshot.state)
        if target:
            was_in_game = self.current.state is SessionState.IN_GAME
            self.current.state = target
            self.current.queue_id = snapshot.queue_id or self.current.queue_id
            if target is SessionState.IN_GAME and not self.current.game_started_at:
                self.current.game_started_at = snapshot.timestamp or time()
            if target is SessionState.WAITING_RESULT and was_in_game and not self.current.game_ended_at:
                self.current.game_ended_at = snapshot.timestamp or time()
            self.storage.save(self.current)
        elif snapshot.state is GameState.LOBBY and self.current.state in {SessionState.QUEUEING, SessionState.READY, SessionState.STARTING}:
            self.current.state = SessionState.ABORTED
            self.storage.save(self.current)
        return self.current
