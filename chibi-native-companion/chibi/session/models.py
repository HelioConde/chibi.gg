from dataclasses import asdict, dataclass, field
from enum import Enum
from time import time
from typing import Any

class SessionState(str, Enum):
    IDLE = "idle"; QUEUEING = "queueing"; READY = "ready"; STARTING = "starting"; IN_GAME = "in_game"; WAITING_RESULT = "waiting_result"; COMPLETED = "completed"; ABORTED = "aborted"

@dataclass
class ChibiSession:
    id: str
    riot_id: str
    focus_id: str
    state: SessionState = SessionState.IDLE
    platform: str = "br1"
    queue_id: int | None = None
    created_at: float = field(default_factory=time)
    game_started_at: float | None = None
    game_ended_at: float | None = None
    pre_game_match_ids: tuple[str, ...] = ()
    match_id: str | None = None
    result: dict[str, Any] | None = None
    completed_at: float | None = None
    poll_attempts: int = 0
    postgame_status: str = "idle"

    @property
    def is_waiting(self) -> bool: return self.state is SessionState.WAITING_RESULT
    def to_dict(self) -> dict[str, Any]:
        data = asdict(self); data["state"] = self.state.value; return data
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ChibiSession":
        return cls(id=str(data["id"]), riot_id=str(data["riot_id"]), focus_id=str(data["focus_id"]), state=SessionState(str(data.get("state", "idle"))), platform=str(data.get("platform") or "br1"), queue_id=data.get("queue_id") if isinstance(data.get("queue_id"), int) else None, created_at=float(data.get("created_at") or time()), game_started_at=_float(data.get("game_started_at")), game_ended_at=_float(data.get("game_ended_at")), pre_game_match_ids=tuple(value for value in data.get("pre_game_match_ids", []) if isinstance(value, str)), match_id=data.get("match_id") if isinstance(data.get("match_id"), str) else None, result=data.get("result") if isinstance(data.get("result"), dict) else None, completed_at=_float(data.get("completed_at")), poll_attempts=int(data.get("poll_attempts") or 0), postgame_status=str(data.get("postgame_status") or "idle"))

def _float(value: object) -> float | None:
    try: return float(value) if value is not None else None
    except (TypeError, ValueError): return None
