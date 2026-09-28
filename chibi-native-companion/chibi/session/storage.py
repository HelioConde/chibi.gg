from __future__ import annotations
import json
from pathlib import Path
from chibi.core.settings import app_data_dir
from .models import ChibiSession

class SessionStorage:
    def __init__(self) -> None: self.directory = app_data_dir() / "sessions"; self.directory.mkdir(parents=True, exist_ok=True)
    def save(self, session: ChibiSession) -> Path:
        path = self.directory / f"{session.id}.json"; path.write_text(json.dumps(session.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8"); return path
    def load_waiting(self) -> ChibiSession | None:
        sessions: list[ChibiSession] = []
        for path in self.directory.glob("*.json"):
            try: sessions.append(ChibiSession.from_dict(json.loads(path.read_text(encoding="utf-8"))))
            except (OSError, ValueError, TypeError): continue
        waiting = [session for session in sessions if session.is_waiting]
        return max(waiting, key=lambda session: session.game_ended_at or 0, default=None)
