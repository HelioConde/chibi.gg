from __future__ import annotations

import logging
from time import time

from PySide6.QtCore import QObject, QTimer, Signal

from chibi.vision.window import find_tft_window

from .checkpoint import TFTCheckpointProvider
from .events import TFTEvent
from .heartbeat import TFTHeartbeatProvider
from .input import TFTInputProvider
from .liveclient import TFTLiveClientProvider
from .logs import TFTLogProvider
from .reducer import ChibiStateReducer
from .vision import vision_gold_provider, vision_level_provider, vision_round_provider

LOGGER = logging.getLogger("chibi.native.tracker")


class TFTTrackerMonitor(QObject):
    state_changed = Signal(object)
    event_emitted = Signal(object)

    def __init__(self, interval_ms: int = 350) -> None:
        super().__init__()
        self.reducer = ChibiStateReducer()
        self.heartbeat = TFTHeartbeatProvider()
        self.log = TFTLogProvider()
        self.input = TFTInputProvider(find_tft_window)
        self.checkpoint = TFTCheckpointProvider()
        self.liveclient = TFTLiveClientProvider()
        lifecycle = lambda: self.reducer.state.lifecycle
        self.vision_level = vision_level_provider(lifecycle)
        self.vision_gold = vision_gold_provider(lifecycle)
        self.vision_round = vision_round_provider(lifecycle)
        self.providers = (self.heartbeat, self.log, self.input, self.checkpoint, self.liveclient, self.vision_level, self.vision_gold, self.vision_round)
        self._provider_key: tuple[tuple[str, str], ...] = ()
        self.timer = QTimer(self)
        self.timer.setInterval(interval_ms)
        self.timer.timeout.connect(self.poll)

    def set_puuid(self, puuid: str) -> None:
        self.reducer.set_puuid(puuid)
        self.checkpoint.set_puuid(puuid)

    def start(self) -> None:
        self.timer.start()
        self.poll()

    def stop(self) -> None:
        self.timer.stop()

    def poll(self) -> None:
        changed = False
        for provider in self.providers:
            try:
                events = provider.poll()
            except Exception as error:
                provider.status = "error"
                LOGGER.info("[%s] error=%s", provider.name, type(error).__name__)
                events = []
            self.reducer.state.providers[provider.name] = provider.status
            for event in events:
                self.reducer.apply(event)
                self.event_emitted.emit(event)
                changed = True
        provider_key = tuple(sorted(self.reducer.state.providers.items()))
        if provider_key != self._provider_key:
            self._provider_key = provider_key
            self.reducer.state.updated_at = time()
            changed = True
        if changed:
            self.state_changed.emit(self.reducer.state)
