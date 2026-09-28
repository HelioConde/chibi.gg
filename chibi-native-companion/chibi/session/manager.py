from __future__ import annotations

from chibi.riot.lcu.models import GameState, GameStateSnapshot
from .focus import FOCUSES, SessionFocus
from .models import ChibiSession, SessionState

class SessionManager:
    def __init__(self, focus: SessionFocus | None = None) -> None:
        self.focus = focus or FOCUSES[2]
        self.current: ChibiSession | None = None
    def set_focus(self, focus: SessionFocus) -> None: self.focus = focus
    def on_gameflow(self, snapshot: GameStateSnapshot) -> ChibiSession | None:
        if snapshot.state is GameState.MATCHMAKING and self.current is None:
            self.current = ChibiSession(snapshot.riot_id, self.focus.id, SessionState.QUEUEING)
        if not self.current: return None
        target = {GameState.MATCHMAKING: SessionState.QUEUEING, GameState.READY_CHECK: SessionState.READY, GameState.READY_CHECK_ACCEPTED: SessionState.STARTING, GameState.PREPARING: SessionState.STARTING, GameState.IN_GAME: SessionState.IN_GAME, GameState.POST_GAME: SessionState.WAITING_RESULT}.get(snapshot.state)
        if target: self.current.state = target
        elif snapshot.state is GameState.LOBBY and self.current.state in {SessionState.QUEUEING, SessionState.READY, SessionState.STARTING}:
            self.current.state = SessionState.ABORTED
        return self.current
