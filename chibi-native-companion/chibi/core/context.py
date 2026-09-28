from __future__ import annotations

from dataclasses import dataclass, field

from chibi.riot.lcu.models import GameStateSnapshot
from chibi.telemetry.models import TelemetrySnapshot


@dataclass
class CompanionContext:
    gameflow: GameStateSnapshot = field(default_factory=GameStateSnapshot.offline)
    telemetry: TelemetrySnapshot = field(default_factory=TelemetrySnapshot.unavailable)
