from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from time import time
from typing import Any, Generic, TypeVar


T = TypeVar("T")


class FieldSource(str, Enum):
    LIVE = "live"
    REVIEW = "review"
    UNAVAILABLE = "unavailable"


@dataclass(frozen=True, slots=True)
class LiveField(Generic[T]):
    value: T | None
    source: FieldSource
    updated_at: float = field(default_factory=time)
    available: bool = True

    @classmethod
    def unavailable(cls) -> "LiveField[T]":
        return cls(value=None, source=FieldSource.UNAVAILABLE, available=False)


@dataclass(frozen=True, slots=True)
class RiotLiveState:
    """Only fields verified as live. Unavailable is explicit, never a review fallback."""

    stage: LiveField[str] = field(default_factory=LiveField.unavailable)
    hp: LiveField[int] = field(default_factory=LiveField.unavailable)
    gold: LiveField[int] = field(default_factory=LiveField.unavailable)
    level: LiveField[int] = field(default_factory=LiveField.unavailable)
    streak: LiveField[str] = field(default_factory=LiveField.unavailable)
    board: LiveField[list[object]] = field(default_factory=LiveField.unavailable)


class GameState(str, Enum):
    CLIENT_OFFLINE = "client_offline"
    LOBBY = "lobby"
    MATCHMAKING = "matchmaking"
    READY_CHECK = "ready_check"
    READY_CHECK_ACCEPTED = "ready_check_accepted"
    READY_CHECK_DECLINED = "ready_check_declined"
    CHAMP_SELECT = "champ_select"
    IN_GAME = "in_game"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class GameStateSnapshot:
    state: GameState
    raw_phase: str = ""
    player_response: str | None = None
    queue_id: int | None = None
    queue_name: str = ""
    timestamp: float = field(default_factory=time)
    connected: bool = False
    riot_id: str = ""
    details: dict[str, Any] = field(default_factory=dict)
    live: RiotLiveState = field(default_factory=RiotLiveState)

    @property
    def transition_key(self) -> tuple[object, ...]:
        return (
            self.state,
            self.raw_phase,
            self.player_response,
            self.queue_id,
            self.queue_name,
            self.connected,
            self.riot_id,
        )


@dataclass(frozen=True, slots=True)
class StatePresentation:
    icon: str
    title: str
    description: str
    tone: str


PRESENTATIONS: dict[GameState, StatePresentation] = {
    GameState.CLIENT_OFFLINE: StatePresentation("○", "CLIENTE RIOT OFFLINE", "Abra o cliente Riot para conectar.", "neutral"),
    GameState.LOBBY: StatePresentation("◌", "PRONTO PARA JOGAR", "Entre na fila quando quiser.", "neutral"),
    GameState.MATCHMAKING: StatePresentation("◌", "NA FILA", "Procurando partida...", "queue"),
    GameState.READY_CHECK: StatePresentation("!", "CONFIRME A PARTIDA", "Partida encontrada. Responda no cliente Riot.", "alert"),
    GameState.READY_CHECK_ACCEPTED: StatePresentation("✓", "PARTIDA ACEITA", "Resposta registrada. Aguardando jogadores.", "success"),
    GameState.READY_CHECK_DECLINED: StatePresentation("×", "PARTIDA RECUSADA", "Você recusou a partida.", "danger"),
    GameState.CHAMP_SELECT: StatePresentation("◇", "PREPARANDO A PARTIDA", "Seleção em andamento.", "queue"),
    GameState.IN_GAME: StatePresentation("●", "EM PARTIDA", "Boa partida.", "success"),
    GameState.UNKNOWN: StatePresentation("?", "ESTADO DESCONHECIDO", "Aguardando uma atualização do cliente.", "neutral"),
}
