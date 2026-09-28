from __future__ import annotations

from chibi_overlay.riot.gameflow import normalize_gameflow
from chibi_overlay.riot.models import GameState


def state(phase: str, response: str | None = None) -> GameState:
    return normalize_gameflow(
        connected=True, phase=phase, player_response=response
    ).state


def test_accepted_match_sequence() -> None:
    assert [
        state("Lobby"),
        state("Matchmaking"),
        state("ReadyCheck"),
        state("ReadyCheck", "Accepted"),
        state("ChampSelect"),
        state("InProgress"),
        state("Lobby"),
    ] == [
        GameState.LOBBY,
        GameState.MATCHMAKING,
        GameState.READY_CHECK,
        GameState.READY_CHECK_ACCEPTED,
        GameState.CHAMP_SELECT,
        GameState.IN_GAME,
        GameState.LOBBY,
    ]


def test_declined_match_sequence() -> None:
    assert [
        state("Lobby"),
        state("Matchmaking"),
        state("ReadyCheck"),
        state("ReadyCheck", "Declined"),
        state("Lobby"),
    ] == [
        GameState.LOBBY,
        GameState.MATCHMAKING,
        GameState.READY_CHECK,
        GameState.READY_CHECK_DECLINED,
        GameState.LOBBY,
    ]
