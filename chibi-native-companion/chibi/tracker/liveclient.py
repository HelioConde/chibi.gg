from __future__ import annotations

import json
import logging
import ssl
from time import monotonic
from urllib.error import URLError
from urllib.request import urlopen

from .events import EventType, TFTEvent
from .values import valid_gold, valid_level


LOGGER = logging.getLogger("chibi.native.tracker")


class TFTLiveClientProvider:
    """Best-effort optional provider. The tracker never relies on it."""
    name = "LiveClientData"

    def __init__(self, fetch: object | None = None, clock: object | None = None) -> None:
        self.status = "unavailable"
        self.fetch = fetch
        self.clock = clock or monotonic
        self._next_attempt = 0.0
        self._backoff = 1.0

    def _set_status(self, status: str) -> None:
        if self.status != status:
            self.status = status
            LOGGER.info("[LiveClient] 2999 %s", status)

    def poll(self) -> list[TFTEvent]:
        now = self.clock()
        if now < self._next_attempt:
            return []
        try:
            if callable(self.fetch):
                data = self.fetch()
            else:
                context = ssl._create_unverified_context()
                with urlopen("https://127.0.0.1:2999/liveclientdata/activeplayer", timeout=0.35, context=context) as response:
                    data = json.load(response)
            if not isinstance(data, dict):
                raise ValueError("invalid_liveclient_payload")
            active = data.get("activePlayer") if isinstance(data.get("activePlayer"), dict) else data
            events: list[TFTEvent] = []
            level = active.get("level")
            gold = active.get("currentGold")
            if valid_level(level):
                events.append(TFTEvent(EventType.LEVEL_UPDATED, "LIVE_CLIENT", {"value": level}))
            if valid_gold(gold):
                events.append(TFTEvent(EventType.GOLD_UPDATED, "LIVE_CLIENT", {"value": gold}))
            self._set_status("connected")
            self._backoff, self._next_attempt = 1.0, now + 1.0
            return events
        except (OSError, URLError, ValueError):
            self._set_status("unavailable")
            self._next_attempt = now + self._backoff
            self._backoff = min(12.0, self._backoff * 2)
            return []
