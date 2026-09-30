from __future__ import annotations

from dataclasses import replace
from time import time

from .events import EventType, TFTEvent
from .entities import TFTChampionResolver
from .models import BoardPiece, ChibiGameState, ObservedValue
from .normalize import normalize_champion_id


class ChibiStateReducer:
    def __init__(self, puuid: str = "") -> None:
        self.state = ChibiGameState()
        self.state.player.puuid = puuid
        self.entities = TFTChampionResolver()

    def set_puuid(self, puuid: str) -> None:
        if puuid:
            self.state.player.puuid = puuid

    def apply(self, event: TFTEvent) -> ChibiGameState:
        self.state.last_event = event.type.value
        self.state.updated_at = event.timestamp
        if event.type is EventType.HEARTBEAT_UPDATED:
            self.state.lifecycle = str(event.payload.get("lifecycle") or self.state.lifecycle)
            self.state.heartbeat_phase = str(event.payload.get("phase") or "") or None
            self.state.tft_pid = event.payload.get("pid") if isinstance(event.payload.get("pid"), int) else None
        elif event.type is EventType.UNIT_PURCHASED:
            self._append(self.state.purchases, event)
        elif event.type is EventType.UNIT_STAR_UP:
            self._append(self.state.star_ups, event)
            self._apply_star_up(event)
        elif event.type is EventType.SELL_MODE_ACTIVE:
            self._append(self.state.possible_sells, event)
        elif event.type is EventType.SHOP_REROLLED:
            self.state.rerolls += 1
        elif event.type is EventType.XP_PURCHASED:
            self.state.xp_purchases += 1
        elif event.type is EventType.CHECKPOINT_UPDATED:
            self._apply_checkpoint(event)
        elif event.type is EventType.LEVEL_UPDATED:
            self._update_observed("level", event)
        elif event.type is EventType.GOLD_UPDATED:
            self._update_observed("gold", event)
        elif event.type is EventType.ROUND_UPDATED:
            self._update_observed("round", event)
        return self.state

    @staticmethod
    def _append(target: list[dict[str, object]], event: TFTEvent) -> None:
        target.append({"timestamp": event.timestamp, **event.payload, "source": event.source, "confidence": event.confidence})
        del target[:-50]

    def _apply_star_up(self, event: TFTEvent) -> None:
        raw_id = str(event.payload.get("rawId") or event.payload.get("championId") or "")
        stars = event.payload.get("stars")
        if not raw_id or not isinstance(stars, int):
            return
        for index, piece in enumerate(self.state.board):
            if piece.raw_id == raw_id or piece.champion_id == normalize_champion_id(raw_id):
                self.state.board[index] = replace(piece, stars=stars)
                return

    def _apply_checkpoint(self, event: TFTEvent) -> None:
        payload = event.payload
        self.state.game_id = str(payload.get("gameId") or self.state.game_id or "") or None
        self.state.set_name = str(payload.get("setCoreName") or self.state.set_name or "") or None
        self.state.checkpoint_at = event.timestamp
        health = payload.get("health")
        if isinstance(health, int):
            self.state.player.hp = ObservedValue(health, event.source, event.confidence, event.timestamp)
        board = payload.get("boardPieces")
        if isinstance(board, list):
            self.state.board = [self._piece(value) for value in board if isinstance(value, dict)]
        augments = payload.get("augments")
        if isinstance(augments, list):
            self.state.augments = [str(value) for value in augments if str(value)]

    def _update_observed(self, field: str, event: TFTEvent) -> None:
        value = event.payload.get("value")
        target = self.state.round if field == "round" else getattr(self.state.player, field)
        candidate = ObservedValue(value, event.source, event.confidence, event.timestamp)
        if not _should_replace(target, candidate):
            return
        if field == "round":
            self.state.round = candidate
        else:
            setattr(self.state.player, field, candidate)

    def _piece(self, value: dict[str, object]) -> BoardPiece:
        raw = str(value.get("championName") or value.get("characterId") or "")
        items = value.get("itemNames") if isinstance(value.get("itemNames"), list) else value.get("items")
        entity = self.entities.resolve(raw)
        return BoardPiece(
            champion_id=entity.canonical_id, raw_id=raw, display_name=entity.display_name, resolved=entity.resolved,
            stars=value.get("starLevel") if isinstance(value.get("starLevel"), int) else None,
            price=value.get("price") if isinstance(value.get("price"), int) else None,
            items=tuple(self.entities.resolve_item(str(item)).display_name for item in items if str(item)) if isinstance(items, list) else (),
        )


_SOURCE_PRIORITY = {
    "TFT_CHECKPOINT": 100,
    "LIVE_CLIENT": 90,
    "TFT_LOG": 70,
    "TFT_INPUT": 60,
    "INPUT": 60,  # Compatibility with any previously persisted observation.
    "VISION": 40,
    "DERIVED": 20,
    "unknown": 0,
}


def _should_replace(current: ObservedValue[object], candidate: ObservedValue[object]) -> bool:
    if candidate.value is None:
        return False
    if current.value is None or candidate.source == current.source:
        return True
    current_score = _SOURCE_PRIORITY.get(current.source, 0) + current.confidence * 10
    candidate_score = _SOURCE_PRIORITY.get(candidate.source, 0) + candidate.confidence * 10
    return candidate_score >= current_score
