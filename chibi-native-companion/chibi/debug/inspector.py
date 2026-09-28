from __future__ import annotations
import json
from pathlib import Path
from chibi.core.settings import app_data_dir
from chibi.debug.sanitizer import sanitize
from chibi.riot.game.detector import GameProcessDetector
from chibi.riot.game.localhost import localhost_services
from chibi.riot.game.logs import discover_logs
from chibi.telemetry.manager import TelemetryManager

def investigate(connected: bool) -> Path:
    detector = GameProcessDetector(); processes = detector.snapshot(); services, logs, telemetry = localhost_services(processes), discover_logs(processes), TelemetryManager().poll()
    fields = ("stage", "hp", "gold", "level", "xp", "board", "bench", "store")
    report = {"riot_client": {"connected": connected}, "game_processes": [item.to_dict() for item in processes], "local_services": [item.to_dict() for item in services], "log_sources": [item.to_dict() for item in logs], "telemetry": {field: {"source": getattr(telemetry, field).source, "confidence": getattr(telemetry, field).confidence.value} for field in fields}}
    path = app_data_dir() / "debug" / "investigation-report.json"; path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(sanitize(report), ensure_ascii=False, indent=2), encoding="utf-8")
    return path
