from __future__ import annotations

from chibi_overlay.models import OverlaySnapshot, fields_for_overlay
from chibi_overlay.riot.models import FieldSource, GameState, RiotLiveState


def test_in_game_never_falls_back_to_demo_review_values() -> None:
    demo_review = OverlaySnapshot.from_dict(
        {
            "stage": "3-2",
            "hp": 72,
            "gold": 38,
            "level": 6,
            "streak": "W2",
            "board": [{"slot": 15, "label": "T", "role": "tank"}],
        }
    )
    fields = fields_for_overlay(
        riot_state=GameState.IN_GAME,
        live=RiotLiveState(),
        review=demo_review,
    )

    assert fields.stage.value is None
    assert fields.hp.value is None
    assert fields.gold.value is None
    assert fields.level.value is None
    assert fields.streak.value is None
    assert fields.board.value is None
    assert all(
        field.source is FieldSource.UNAVAILABLE
        for field in (
            fields.stage,
            fields.hp,
            fields.gold,
            fields.level,
            fields.streak,
            fields.board,
        )
    )


def test_review_values_keep_an_explicit_review_origin_outside_game() -> None:
    review = OverlaySnapshot.from_dict({"stage": "3-2", "gold": 38})
    fields = fields_for_overlay(
        riot_state=GameState.LOBBY,
        live=RiotLiveState(),
        review=review,
    )
    assert fields.stage.value == "3-2"
    assert fields.gold.value == 38
    assert fields.stage.source is FieldSource.REVIEW
