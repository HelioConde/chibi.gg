from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable
from typing import Any


class EventBus:
    """Small in-process bus. Producers never need to know the UI."""

    def __init__(self) -> None:
        self._listeners: dict[str, list[Callable[[Any], None]]] = defaultdict(list)

    def subscribe(self, event: str, callback: Callable[[Any], None]) -> None:
        self._listeners[event].append(callback)

    def publish(self, event: str, payload: Any) -> None:
        for callback in tuple(self._listeners[event]):
            callback(payload)
