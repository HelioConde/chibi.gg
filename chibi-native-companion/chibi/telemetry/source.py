from __future__ import annotations

from typing import Protocol
from .models import TelemetrySnapshot

class TelemetrySource(Protocol):
    name: str
    def available(self) -> bool: ...
    def poll(self) -> TelemetrySnapshot: ...
