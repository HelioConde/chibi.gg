from __future__ import annotations

from .confidence import DataConfidence
from .models import LiveField, TelemetrySnapshot
from .source import TelemetrySource

class TelemetryManager:
    def __init__(self, sources: list[TelemetrySource] | None = None) -> None: self.sources = sources or []
    def poll(self) -> TelemetrySnapshot:
        snapshots = [source.poll() for source in self.sources if source.available()]
        if not snapshots: return TelemetrySnapshot.unavailable()
        values = {}
        for field in ("stage", "hp", "gold", "level", "xp", "board", "bench", "store"):
            values[field] = next((getattr(snapshot, field) for snapshot in snapshots if getattr(snapshot, field).confidence is DataConfidence.VERIFIED), LiveField())
        return TelemetrySnapshot(**values)
