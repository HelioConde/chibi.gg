from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


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
