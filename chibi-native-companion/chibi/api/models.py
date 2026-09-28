from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class MatchResult:
    match_id: str
    placement: int
    level: int
    gold_left: int
    last_round: int | None
    time_eliminated: float | None
    damage_to_players: int
    players_eliminated: int
    set_number: int
    set_name: str
    queue_id: int
    played_at: int
    duration: float
    augments: tuple[str, ...] = ()
    traits: tuple[dict[str, object], ...] = ()
    units: tuple[dict[str, object], ...] = ()

@dataclass(frozen=True, slots=True)
class HistoryMatch:
    id: str
    played_at: int
    duration: float
    queue_id: int
    payload: dict[str, object]
