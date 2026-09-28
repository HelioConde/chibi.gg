from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .connection import LcuConnection, LcuUnavailableError


@dataclass(frozen=True, slots=True)
class Player:
    riot_id: str
    puuid: str


@dataclass(frozen=True, slots=True)
class Session:
    queue_id: int | None
    queue_name: str
    game_mode: str
    is_ranked: bool
    player_count: int


class LcuClient:
    def __init__(self) -> None:
        self.connection = LcuConnection()

    def player(self) -> Player:
        data = self._object("/lol-summoner/v1/current-summoner")
        name = str(data.get("gameName") or data.get("displayName") or "").strip()
        if not name:
            raise LcuUnavailableError("jogador ausente")
        tag = str(data.get("tagLine") or "").strip()
        return Player(f"{name}#{tag}" if tag else name, str(data.get("puuid") or ""))

    def phase(self) -> str:
        phase = self.connection.get_json("/lol-gameflow/v1/gameflow-phase")
        if not isinstance(phase, str):
            raise LcuUnavailableError("phase inválida")
        return phase

    def session(self) -> Session | None:
        try:
            data = self._object("/lol-gameflow/v1/session")
        except LcuUnavailableError:
            return None
        game_data = data.get("gameData") if isinstance(data.get("gameData"), dict) else {}
        queue = game_data.get("queue") if isinstance(game_data.get("queue"), dict) else {}
        players = game_data.get("playerChampionSelections") if isinstance(game_data.get("playerChampionSelections"), list) else []
        queue_id = queue.get("id")
        return Session(queue_id if isinstance(queue_id, int) else None, str(queue.get("shortName") or queue.get("name") or ""), str(queue.get("gameMode") or ""), bool(queue.get("isRanked", False)), len(players))

    def ready_response(self) -> str | None:
        response = self._object("/lol-matchmaking/v1/ready-check").get("playerResponse")
        return str(response) if response else None

    def _object(self, endpoint: str) -> dict[str, Any]:
        data = self.connection.get_json(endpoint)
        if not isinstance(data, dict):
            raise LcuUnavailableError("resposta LCU inválida")
        return data
