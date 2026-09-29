from __future__ import annotations

import logging
from dataclasses import replace
from time import monotonic
from typing import Callable

from chibi.riot.lcu.models import GameState, GameStateSnapshot


LOGGER = logging.getLogger("chibi.native.state")


class GameStateResolver:
    """Arbitrates LCU state with the real TFT process/window lifecycle.

    LCU's phase can briefly remain Lobby while a TFT game is already rendering.
    A valid game process *and* visible game window is stronger evidence than that
    transient LCU value. A short grace period prevents flicker while the client
    tears down its window at game end.
    """

    def __init__(self, grace_seconds: float = 5.0, clock: Callable[[], float] = monotonic) -> None:
        self.grace_seconds = grace_seconds
        self.clock = clock
        self.last_active_at: float | None = None
        self._last_debug_key: tuple[object, ...] | None = None

    def resolve(self, snapshot: GameStateSnapshot, *, tft_process: bool, tft_window: bool) -> GameStateSnapshot:
        now = self.clock()
        active_game = tft_process and tft_window
        if active_game:
            self.last_active_at = now

        # Strong LCU terminal/interaction states take precedence over a process
        # that may legitimately survive a little longer than the game window.
        if snapshot.state is GameState.POST_GAME:
            state, source = GameState.POST_GAME, "LCU"
        elif snapshot.state in {GameState.READY_CHECK, GameState.READY_CHECK_ACCEPTED, GameState.READY_CHECK_DECLINED}:
            state, source = snapshot.state, "LCU"
        elif active_game:
            state, source = GameState.IN_GAME, "COMBINED"
        elif snapshot.state is GameState.IN_GAME:
            state, source = GameState.IN_GAME, "LCU"
        elif self.last_active_at is not None and now - self.last_active_at <= self.grace_seconds and snapshot.state in {GameState.LOBBY, GameState.UNKNOWN, GameState.CLIENT_OFFLINE}:
            state, source = GameState.IN_GAME, "TFT_GRACE"
        else:
            state, source = snapshot.state, "LCU"

        details = dict(snapshot.details)
        details.update({"state_source": source, "tft_process": tft_process, "tft_window": tft_window})
        resolved = replace(snapshot, state=state, details=details)
        debug_key = (snapshot.raw_phase, snapshot.state, tft_process, tft_window, state, source)
        if debug_key != self._last_debug_key:
            LOGGER.info(
                "[STATE] LCU phase=%s LCU state=%s TFT process=%s TFT window=%s resolved=%s source=%s",
                snapshot.raw_phase or "—", snapshot.state.value, tft_process, tft_window, state.value, source,
            )
            self._last_debug_key = debug_key
        return resolved
