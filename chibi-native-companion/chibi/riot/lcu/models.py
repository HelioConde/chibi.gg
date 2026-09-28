from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from time import time
from typing import Any


class GameState(str, Enum):
    CLIENT_OFFLINE = "client_offline"
    LOBBY = "lobby"
    MATCHMAKING = "matchmaking"
    READY_CHECK = "ready_check"
    READY_CHECK_ACCEPTED = "ready_check_accepted"
    READY_CHECK_DECLINED = "ready_check_declined"
    PREPARING = "preparing"
    IN_GAME = "in_game"
    RECONNECTING = "reconnecting"
    POST_GAME = "post_game"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class GameStateSnapshot:
    state: GameState
    connected: bool = False
    riot_id: str = ""
    player_puuid: str = ""
    raw_phase: str = ""
    player_response: str | None = None
    queue_id: int | None = None
    queue_name: str = ""
    details: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time)

    @classmethod
    def offline(cls) -> "GameStateSnapshot":
        return cls(state=GameState.CLIENT_OFFLINE)

    @property
    def transition_key(self) -> tuple[object, ...]:
        return self.state, self.raw_phase, self.player_response, self.queue_id, self.queue_name, self.connected, self.riot_id
