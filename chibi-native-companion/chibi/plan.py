from __future__ import annotations
import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from time import time
from typing import Any
from chibi.core.settings import app_data_dir

@dataclass
class GamePlan:
    primary_comp: str = ""
    fallback_comps: list[str] = field(default_factory=list)
    session_focus: str = "Flexibilidade"
    created_at: float = field(default_factory=time)
    patch: str = ""
    set_number: int | None = None
    core_units: list[str] = field(default_factory=list)
    carries: list[str] = field(default_factory=list)
    frontline: list[str] = field(default_factory=list)
    traits: list[str] = field(default_factory=list)
    carry_items: list[str] = field(default_factory=list)
    tank_items: list[str] = field(default_factory=list)
    level_plan: list[str] = field(default_factory=list)
    roll_plan: list[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "GamePlan":
        strings=lambda key, limit: [str(item).strip() for item in value.get(key, []) if str(item).strip()][:limit] if isinstance(value.get(key, []), list) else []
        return cls(primary_comp=str(value.get("primary_comp") or "").strip()[:100], fallback_comps=strings("fallback_comps",2), session_focus=str(value.get("session_focus") or "Flexibilidade").strip()[:80], created_at=float(value.get("created_at") or time()), patch=str(value.get("patch") or "").strip()[:40], set_number=value.get("set_number") if isinstance(value.get("set_number"),int) else None, core_units=strings("core_units",10), carries=strings("carries",4), frontline=strings("frontline",5), traits=strings("traits",6), carry_items=strings("carry_items",6), tank_items=strings("tank_items",6), level_plan=strings("level_plan",6), roll_plan=strings("roll_plan",6))

class GamePlanStore:
    def __init__(self) -> None: self.path=app_data_dir()/"game-plan.json"
    def load(self) -> GamePlan:
        try: return GamePlan.from_dict(json.loads(self.path.read_text(encoding="utf-8")))
        except (OSError, ValueError, TypeError): return GamePlan()
    def save(self, plan: GamePlan) -> Path:
        self.path.write_text(json.dumps(asdict(plan), ensure_ascii=False, indent=2),encoding="utf-8"); return self.path
    def import_file(self, path: Path) -> GamePlan:
        plan=GamePlan.from_dict(json.loads(path.read_text(encoding="utf-8"))); self.save(plan); return plan
