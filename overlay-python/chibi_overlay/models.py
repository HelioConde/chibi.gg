from __future__ import annotations

from dataclasses import dataclass, field
from time import time
from typing import Any

from .riot.models import FieldSource, GameState, LiveField, RiotLiveState


@dataclass(slots=True)
class BoardUnit:
    slot: int
    label: str
    role: str = ""

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "BoardUnit":
        slot = max(0, min(27, int(data.get("slot", 0))))
        return cls(
            slot=slot,
            label=str(data.get("label", "?"))[:8] or "?",
            role=str(data.get("role", ""))[:24],
        )


@dataclass(slots=True)
class OverlaySnapshot:
    player: str = "Seu Riot ID"
    rank: str = "Perfil ainda não conectado"
    focus: str = "Revise uma decisão por vez"
    avoid: str = "Evite transformar o overlay em piloto automático."
    stage: str = "—"
    hp: int | None = None
    gold: int | None = None
    level: int | None = None
    streak: str = "—"
    status: str = "SNAPSHOT LOCAL"
    score: int | None = None
    review_questions: list[str] = field(default_factory=list)
    board: list[BoardUnit] = field(default_factory=list)
    updated_at: str = ""

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "OverlaySnapshot":
        def optional_int(key: str) -> int | None:
            value = data.get(key)
            if value in (None, ""):
                return None
            try:
                return int(value)
            except (TypeError, ValueError):
                return None

        questions = [
            str(item).strip()
            for item in data.get("review_questions", [])
            if str(item).strip()
        ][:3]

        board = []
        for item in data.get("board", []):
            if isinstance(item, dict):
                board.append(BoardUnit.from_dict(item))

        return cls(
            player=str(data.get("player", "Seu Riot ID"))[:80],
            rank=str(data.get("rank", "Perfil ainda não conectado"))[:100],
            focus=str(data.get("focus", "Revise uma decisão por vez"))[:180],
            avoid=str(data.get("avoid", "Evite transformar o overlay em piloto automático."))[:220],
            stage=str(data.get("stage", "—"))[:16],
            hp=optional_int("hp"),
            gold=optional_int("gold"),
            level=optional_int("level"),
            streak=str(data.get("streak", "—"))[:16],
            status=str(data.get("status", "SNAPSHOT LOCAL"))[:80],
            score=optional_int("score"),
            review_questions=questions,
            board=board,
            updated_at=str(data.get("updated_at", ""))[:64],
        )


@dataclass(frozen=True, slots=True)
class OverlayFields:
    """View model that prevents review data from masquerading as live game data."""

    stage: LiveField[str]
    hp: LiveField[int]
    gold: LiveField[int]
    level: LiveField[int]
    streak: LiveField[str]
    board: LiveField[list[BoardUnit]]


def fields_for_overlay(
    *, riot_state: GameState, live: RiotLiveState, review: OverlaySnapshot
) -> OverlayFields:
    if riot_state is GameState.IN_GAME:
        return OverlayFields(
            stage=live.stage,
            hp=live.hp,
            gold=live.gold,
            level=live.level,
            streak=live.streak,
            board=LiveField(value=live.board.value, source=live.board.source, updated_at=live.board.updated_at),
        )

    updated_at = time()
    return OverlayFields(
        stage=LiveField(review.stage or None, FieldSource.REVIEW, updated_at),
        hp=LiveField(review.hp, FieldSource.REVIEW, updated_at),
        gold=LiveField(review.gold, FieldSource.REVIEW, updated_at),
        level=LiveField(review.level, FieldSource.REVIEW, updated_at),
        streak=LiveField(review.streak or None, FieldSource.REVIEW, updated_at),
        board=LiveField(review.board, FieldSource.REVIEW, updated_at),
    )
