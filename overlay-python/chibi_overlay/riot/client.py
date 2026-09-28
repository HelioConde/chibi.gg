from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .connection import LcuConnection, LcuUnavailableError
from .models import Participant


@dataclass(frozen=True, slots=True)
class CurrentPlayer:
    game_name: str
    tag_line: str
    puuid: str
    profile_icon_id: int | None = None

    @property
    def riot_id(self) -> str:
        return f"{self.game_name}#{self.tag_line}" if self.tag_line else self.game_name


@dataclass(frozen=True, slots=True)
class GameSession:
    phase: str
    game_mode: str
    queue_id: int | None
    queue_name: str
    player_count: int
    is_ranked: bool
    participants: tuple[Participant, ...] = ()


class LcuClient:
    """Read-only view of the League Client API. It never sends game actions."""

    def __init__(self, lockfile_path: str | None = None) -> None:
        self.connection = LcuConnection(lockfile_path)

    def current_player(self) -> CurrentPlayer:
        data = self._object("/lol-summoner/v1/current-summoner")
        game_name = str(data.get("gameName") or data.get("displayName") or "").strip()
        if not game_name:
            raise LcuUnavailableError("A API local não retornou o nome do jogador.")
        icon_id = data.get("profileIconId")
        return CurrentPlayer(
            game_name,
            str(data.get("tagLine") or "").strip(),
            str(data.get("puuid") or "").strip(),
            icon_id if isinstance(icon_id, int) else None,
        )

    def gameflow_phase(self) -> str:
        phase = self.connection.get_json("/lol-gameflow/v1/gameflow-phase")
        if not isinstance(phase, str) or not phase:
            raise LcuUnavailableError("A API local não retornou o estado do cliente.")
        return phase

    def gameflow_session(self) -> GameSession | None:
        try:
            data = self._object("/lol-gameflow/v1/session")
        except LcuUnavailableError:
            return None
        game_data = data.get("gameData") if isinstance(data.get("gameData"), dict) else {}
        queue = game_data.get("queue") if isinstance(game_data.get("queue"), dict) else {}
        selections = game_data.get("playerChampionSelections") if isinstance(game_data.get("playerChampionSelections"), list) else []
        queue_id = queue.get("id")
        return GameSession(
            phase=str(data.get("phase") or "None"),
            game_mode=str(queue.get("gameMode") or ""),
            queue_id=queue_id if isinstance(queue_id, int) else None,
            queue_name=str(queue.get("shortName") or queue.get("name") or ""),
            player_count=len(selections),
            is_ranked=bool(queue.get("isRanked", False)),
            participants=tuple(self._participants(selections)),
        )

    def ready_check_response(self) -> str | None:
        data = self._object("/lol-matchmaking/v1/ready-check")
        response = data.get("playerResponse")
        return str(response) if response else None

    def _object(self, endpoint: str) -> dict[str, Any]:
        data = self.connection.get_json(endpoint)
        if not isinstance(data, dict):
            raise LcuUnavailableError("A API local retornou uma resposta inválida.")
        return data

    @staticmethod
    def _participants(selections: list[object]) -> list[Participant]:
        """Keep only session fields that are already present in the LCU payload."""
        participants: list[Participant] = []
        for selection in selections:
            if not isinstance(selection, dict):
                continue
            raw_summoner_id = selection.get("summonerId")
            raw_icon_id = selection.get("profileIconId")
            cosmetics = {
                str(key): value
                for key, value in selection.items()
                if any(token in str(key).casefold() for token in ("skin", "cosmetic", "companion"))
            }
            participants.append(
                Participant(
                    puuid=str(selection.get("puuid") or ""),
                    summoner_id=raw_summoner_id if isinstance(raw_summoner_id, int) else None,
                    profile_icon_id=raw_icon_id if isinstance(raw_icon_id, int) else None,
                    cosmetics=cosmetics,
                )
            )
        return participants
