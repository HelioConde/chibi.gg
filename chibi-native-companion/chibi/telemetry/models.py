from __future__ import annotations

from dataclasses import dataclass, field
from time import time
from typing import Generic, TypeVar

from .confidence import DataConfidence

T = TypeVar("T")

@dataclass(frozen=True, slots=True)
class LiveField(Generic[T]):
    value: T | None = None
    source: str | None = None
    confidence: DataConfidence = DataConfidence.UNAVAILABLE
    updated_at: float = 0.0
    stale: bool = True

@dataclass(frozen=True, slots=True)
class TelemetrySnapshot:
    stage: LiveField[str] = field(default_factory=LiveField)
    hp: LiveField[int] = field(default_factory=LiveField)
    gold: LiveField[int] = field(default_factory=LiveField)
    level: LiveField[int] = field(default_factory=LiveField)
    xp: LiveField[int] = field(default_factory=LiveField)
    board: LiveField[list] = field(default_factory=LiveField)
    bench: LiveField[list] = field(default_factory=LiveField)
    store: LiveField[list] = field(default_factory=LiveField)
    updated_at: float = field(default_factory=time)

    @classmethod
    def unavailable(cls) -> "TelemetrySnapshot": return cls()
