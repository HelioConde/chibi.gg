from __future__ import annotations

from dataclasses import dataclass, field
from time import time
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass(frozen=True, slots=True)
class ObservedValue(Generic[T]):
    value: T | None = None
    source: str = "unknown"
    confidence: float = 0.0
    observed_at: float = 0.0


@dataclass(frozen=True, slots=True)
class BoardPiece:
    champion_id: str | None
    raw_id: str
    display_name: str
    resolved: bool
    stars: int | None = None
    price: int | None = None
    items: tuple[str, ...] = ()


@dataclass
class PlayerState:
    puuid: str = ""
    hp: ObservedValue[int] = field(default_factory=ObservedValue)
    level: ObservedValue[int] = field(default_factory=ObservedValue)
    xp: ObservedValue[int] = field(default_factory=ObservedValue)
    gold: ObservedValue[int] = field(default_factory=ObservedValue)


@dataclass
class ChibiGameState:
    lifecycle: str = "unknown"
    heartbeat_phase: str | None = None
    tft_pid: int | None = None
    game_id: str | None = None
    set_name: str | None = None
    round: ObservedValue[str] = field(default_factory=ObservedValue)
    started_at: float | None = None
    player: PlayerState = field(default_factory=PlayerState)
    board: list[BoardPiece] = field(default_factory=list)
    bench: list[BoardPiece] = field(default_factory=list)
    shop: list[BoardPiece] = field(default_factory=list)
    augments: list[str] = field(default_factory=list)
    items: list[str] = field(default_factory=list)
    rerolls: int = 0
    xp_purchases: int = 0
    purchases: list[dict[str, object]] = field(default_factory=list)
    star_ups: list[dict[str, object]] = field(default_factory=list)
    possible_sells: list[dict[str, object]] = field(default_factory=list)
    last_event: str | None = None
    checkpoint_at: float | None = None
    providers: dict[str, str] = field(default_factory=dict)
    vision: dict[str, object] = field(default_factory=dict)
    updated_at: float = field(default_factory=time)
