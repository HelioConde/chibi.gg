from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from time import time
from typing import Any


class EventType(StrEnum):
    HEARTBEAT_UPDATED = "HEARTBEAT_UPDATED"
    UNIT_PURCHASED = "UNIT_PURCHASED"
    UNIT_STAR_UP = "UNIT_STAR_UP"
    ITEM_TO_BENCH = "ITEM_TO_BENCH"
    ITEM_OBTAINED = "ITEM_OBTAINED"
    SELL_MODE_ACTIVE = "SELL_MODE_ACTIVE"
    SHOP_REROLLED = "SHOP_REROLLED"
    XP_PURCHASED = "XP_PURCHASED"
    CHECKPOINT_UPDATED = "CHECKPOINT_UPDATED"
    HP_UPDATED = "HP_UPDATED"
    BOARD_RECONCILED = "BOARD_RECONCILED"
    ITEMS_RECONCILED = "ITEMS_RECONCILED"
    AUGMENTS_RECONCILED = "AUGMENTS_RECONCILED"


@dataclass(frozen=True, slots=True)
class TFTEvent:
    type: EventType
    source: str
    payload: dict[str, Any] = field(default_factory=dict)
    confidence: float = 1.0
    timestamp: float = field(default_factory=time)
