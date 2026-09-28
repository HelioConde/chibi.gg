from __future__ import annotations
import json
from dataclasses import asdict
from pathlib import Path
from chibi.core.settings import app_data_dir
from chibi.debug.sanitizer import sanitize
from chibi.telemetry.models import TelemetrySnapshot

def telemetry_report(snapshot: TelemetrySnapshot) -> Path:
    fields = ("stage", "hp", "gold", "level", "xp", "board", "bench", "store")
    data = {field: {"available": getattr(snapshot, field).value is not None, "source": getattr(snapshot, field).source, "confidence": getattr(snapshot, field).confidence.value} for field in fields}
    path = app_data_dir() / "debug" / "telemetry-report.json"; path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(sanitize(data), ensure_ascii=False, indent=2), encoding="utf-8")
    return path
