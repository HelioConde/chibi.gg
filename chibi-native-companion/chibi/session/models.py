from dataclasses import dataclass
from enum import Enum

class SessionState(str, Enum):
    IDLE = "idle"; QUEUEING = "queueing"; READY = "ready"; STARTING = "starting"; IN_GAME = "in_game"; WAITING_RESULT = "waiting_result"; COMPLETED = "completed"; ABORTED = "aborted"

@dataclass
class ChibiSession:
    riot_id: str
    focus_id: str
    state: SessionState = SessionState.IDLE
