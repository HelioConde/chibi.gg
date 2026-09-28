from __future__ import annotations
import json
from dataclasses import asdict
from pathlib import Path
from chibi.core.settings import app_data_dir
from chibi.debug.sanitizer import sanitize
from chibi.telemetry.models import TelemetrySnapshot
from chibi.session.models import ChibiSession

def telemetry_report(snapshot: TelemetrySnapshot) -> Path:
    fields = ("stage", "hp", "gold", "level", "xp", "board", "bench", "store")
    data = {field: {"available": getattr(snapshot, field).value is not None, "source": getattr(snapshot, field).source, "confidence": getattr(snapshot, field).confidence.value} for field in fields}
    path = app_data_dir() / "debug" / "telemetry-report.json"; path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(sanitize(data), ensure_ascii=False, indent=2), encoding="utf-8")
    return path

def postgame_report(session: ChibiSession, elapsed_seconds: float, error: str | None = None) -> Path:
    data = {"session_id": session.id, "state": session.state.value, "match_id": session.match_id, "poll_attempts": session.poll_attempts, "elapsed_seconds": round(elapsed_seconds, 1), "status": session.postgame_status, **({"error": error} if error else {})}
    path = app_data_dir() / "debug" / "postgame-report.json"; path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(sanitize(data), ensure_ascii=False, indent=2), encoding="utf-8")
    return path
