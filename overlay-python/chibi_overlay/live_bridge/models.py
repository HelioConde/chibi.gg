from __future__ import annotations

from dataclasses import dataclass, field
from time import time
from typing import Generic, TypeVar


T = TypeVar("T")
BRIDGE_VERSION = 1


@dataclass(frozen=True, slots=True)
class LiveValue(Generic[T]):
    value: T | None = None
    updated_at: float = 0.0
    available: bool = False
    stale: bool = True

    @classmethod
    def unavailable(cls) -> "LiveValue[T]":
        return cls()

    @classmethod
    def current(cls, value: T, timestamp: float | None = None) -> "LiveValue[T]":
        return cls(value=value, updated_at=timestamp or time(), available=True, stale=False)


@dataclass(frozen=True, slots=True)
class TftLiveUnit:
    id: str | None = None
    name: str | None = None
    star_level: int | None = None
    position: object | None = None
    items: tuple[str, ...] = ()
    updated_at: float = 0.0


@dataclass(frozen=True, slots=True)
class TftTelemetry:
    connected: bool = False
    game_running: bool = False
    stage: LiveValue[str] = field(default_factory=LiveValue.unavailable)
    gold: LiveValue[int] = field(default_factory=LiveValue.unavailable)
    hp: LiveValue[int] = field(default_factory=LiveValue.unavailable)
    level: LiveValue[int] = field(default_factory=LiveValue.unavailable)
    xp: LiveValue[int] = field(default_factory=LiveValue.unavailable)
    board: LiveValue[tuple[TftLiveUnit, ...]] = field(default_factory=LiveValue.unavailable)
    bench: LiveValue[tuple[TftLiveUnit, ...]] = field(default_factory=LiveValue.unavailable)
    store: LiveValue[tuple[TftLiveUnit, ...]] = field(default_factory=LiveValue.unavailable)
    updated_at: float = 0.0
