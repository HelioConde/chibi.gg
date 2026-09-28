from __future__ import annotations

import json
from pathlib import Path

import pytest

from chibi_overlay.riot.gameflow import normalize_gameflow
from chibi_overlay.riot.models import GameState


FIXTURES = Path(__file__).parent / "fixtures"


@pytest.mark.parametrize("path", sorted(FIXTURES.glob("*.json")))
def test_normalizes_riot_gameflow_fixture(path: Path) -> None:
    fixture = json.loads(path.read_text(encoding="utf-8"))
    snapshot = normalize_gameflow(
        connected=True,
        phase=fixture["phase"],
        player_response=fixture["playerResponse"],
    )
    assert snapshot.state is GameState(fixture["state"])


def test_closed_client_is_offline() -> None:
    assert normalize_gameflow(connected=False).state is GameState.CLIENT_OFFLINE


def test_unknown_phase_stays_explicit() -> None:
    assert normalize_gameflow(connected=True, phase="SomethingNew").state is GameState.UNKNOWN


@pytest.mark.parametrize(
    ("phase", "expected"),
    [
        ("Reconnect", GameState.RECONNECTING),
        ("Reconnecting", GameState.RECONNECTING),
        ("PreEndOfGame", GameState.POST_GAME),
        ("EndOfGame", GameState.POST_GAME),
        ("WaitingForStats", GameState.POST_GAME),
    ],
)
def test_normalizes_reconnect_and_post_game_phases(phase: str, expected: GameState) -> None:
    assert normalize_gameflow(connected=True, phase=phase).state is expected
