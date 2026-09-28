from __future__ import annotations
import json
from pathlib import Path
from time import time
from chibi.core.settings import app_data_dir
from chibi.debug.sanitizer import sanitize
from .process import RiotProcess, discover_processes

class GameProcessDetector:
    """Records process metadata only; it never opens a game process handle."""
    def snapshot(self) -> list[RiotProcess]: return discover_processes()
    def record_diff(self) -> Path:
        directory = app_data_dir() / "debug"; directory.mkdir(parents=True, exist_ok=True)
        history_path, report_path = directory / "process-snapshots.json", directory / "process-diff.json"
        try: history = json.loads(history_path.read_text(encoding="utf-8"))
        except (OSError, ValueError): history = []
        history = history if isinstance(history, list) else []
        current = [process.to_dict() for process in self.snapshot()]
        previous = history[-1].get("processes", []) if history and isinstance(history[-1], dict) else []
        old, new = {item.get("pid") for item in previous if isinstance(item, dict)}, {item["pid"] for item in current}
        report = {"captured_at": time(), "processes": current, "started": [item for item in current if item["pid"] not in old], "stopped_pids": sorted(pid for pid in old - new if isinstance(pid, int))}
        history = (history + [{"captured_at": time(), "processes": current}])[-12:]
        history_path.write_text(json.dumps(sanitize(history), ensure_ascii=False, indent=2), encoding="utf-8")
        report_path.write_text(json.dumps(sanitize(report), ensure_ascii=False, indent=2), encoding="utf-8")
        return report_path
