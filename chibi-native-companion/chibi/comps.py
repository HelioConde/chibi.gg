from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from time import time
from typing import Any

from chibi.api.client import ChibiApiClient
from chibi.core.settings import app_data_dir
from chibi.plan import GamePlan


def display_name(value: str) -> str:
    """Make Riot identifiers readable without claiming to know their localized name."""
    text = value.rsplit("_", 1)[-1] if "_" in value else value
    return text.replace("TFT", "").replace("Set", "").strip(" _-") or value


@dataclass(frozen=True, slots=True)
class Comp:
    id: str
    games: int
    average_placement: float
    top4_rate: float
    traits: tuple[str, ...]
    units: tuple[str, ...]
    items: tuple[str, ...]
    unit_items: tuple[tuple[str, tuple[str, ...]], ...]

    @property
    def name(self) -> str:
        return " + ".join(display_name(value) for value in self.traits[:2]) or "Composição observada"

    @classmethod
    def from_api(cls, value: dict[str, Any]) -> "Comp":
        def ids(key: str) -> tuple[str, ...]:
            raw = value.get(key)
            return tuple(str(item.get("id") or "") for item in raw if isinstance(item, dict) and item.get("id")) if isinstance(raw, list) else ()

        entries: list[tuple[str, tuple[str, ...]]] = []
        raw_unit_items = value.get("unitItems")
        if isinstance(raw_unit_items, list):
            for entry in raw_unit_items:
                if not isinstance(entry, dict):
                    continue
                unit_id = str(entry.get("unitId") or "")
                raw_items = entry.get("items")
                item_ids = tuple(str(item.get("id") or "") for item in raw_items if isinstance(item, dict) and item.get("id")) if isinstance(raw_items, list) else ()
                if unit_id:
                    entries.append((unit_id, item_ids))
        return cls(
            id=str(value.get("id") or ""),
            games=int(value.get("games") or 0),
            average_placement=float(value.get("averagePlacement") or 0),
            top4_rate=float(value.get("top4Rate") or 0),
            traits=ids("traits"), units=ids("units"), items=ids("items"), unit_items=tuple(entries),
        )

    def to_plan(self) -> GamePlan:
        carry = self.units[:2]
        frontline = self.units[2:5]
        unit_item_map = dict(self.unit_items)
        return GamePlan(
            primary_comp=self.name,
            session_focus="Economia",
            core_units=list(self.units[:8]),
            carries=list(carry),
            frontline=list(frontline),
            traits=list(self.traits[:4]),
            carry_items=list(unit_item_map.get(carry[0], ())[:3]) if carry else list(self.items[:3]),
            tank_items=list(unit_item_map.get(frontline[0], ())[:3]) if frontline else list(self.items[3:6]),
            level_plan=["Lv 6 · estabilizar se necessário", "Lv 7 · completar o core", "Lv 8 · cap final"],
            roll_plan=["Role para estabilizar; preserve economia quando possível."],
        )


class ChibiCompsClient:
    def __init__(self, client: ChibiApiClient | None = None, path: Path | None = None) -> None:
        self.client = client or ChibiApiClient()
        self.path = path or app_data_dir() / "cache" / "comps.json"

    def load_cache(self) -> list[Comp]:
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            raw = data.get("comps") if isinstance(data, dict) else None
            return [Comp.from_api(value) for value in raw if isinstance(value, dict)] if isinstance(raw, list) else []
        except (OSError, ValueError, TypeError):
            return []

    def fetch(self, queue_id: int = 1100) -> list[Comp]:
        payload = self.client.get_comps(queue_id=queue_id)
        raw = payload.get("comps") if isinstance(payload.get("comps"), list) else []
        self.path.parent.mkdir(parents=True, exist_ok=True)
        context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
        self.path.write_text(json.dumps({
            "fetched_at": time(),
            "patch": str(payload.get("patch") or ""),
            "set": context.get("setNumber"),
            "comps": raw,
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        return [Comp.from_api(value) for value in raw if isinstance(value, dict)]


# Kept as an alias for callers created during the first native milestone.
CompCatalog = ChibiCompsClient
