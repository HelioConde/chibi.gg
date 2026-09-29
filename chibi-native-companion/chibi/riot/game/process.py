from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Iterable

import psutil

RIOT_NAME_TOKENS = ("riotclient", "league", "tft")
EXCLUDED_NAME_TOKENS = ("valorant", "vanguard", "vgc", "vgtray")
TFT_GAME_PROCESS = "tftclient-win64-shipping.exe"

@dataclass(frozen=True, slots=True)
class RiotProcess:
    pid: int
    name: str
    executable: str
    started_at: str
    def to_dict(self) -> dict[str, str | int]: return asdict(self)

def is_riot_process(name: str, executable: str = "") -> bool:
    haystack = f"{name} {executable}".casefold()
    return not any(token in haystack for token in EXCLUDED_NAME_TOKENS) and any(token in haystack for token in RIOT_NAME_TOKENS)

def discover_processes(processes: Iterable[object] | None = None) -> list[RiotProcess]:
    source = processes if processes is not None else psutil.process_iter(["pid", "name", "exe", "create_time"])
    found: list[RiotProcess] = []
    for item in source:
        try:
            info = item.info if hasattr(item, "info") else item
            if not isinstance(info, dict): continue
            name, executable = str(info.get("name") or ""), str(info.get("exe") or "")
            if not is_riot_process(name, executable): continue
            created = info.get("create_time")
            started = datetime.fromtimestamp(float(created), timezone.utc).isoformat() if isinstance(created, (int, float)) else ""
            found.append(RiotProcess(int(info.get("pid") or 0), name, executable, started))
        except (psutil.Error, OSError, ValueError, TypeError): continue
    return sorted(found, key=lambda process: (process.name.casefold(), process.pid))


def tft_game_process_running(processes: Iterable[object] | None = None) -> bool:
    source = processes if processes is not None else psutil.process_iter(["name"])
    for item in source:
        try:
            info = item.info if hasattr(item, "info") else item
            if isinstance(info, dict) and str(info.get("name") or "").casefold() == TFT_GAME_PROCESS:
                return True
        except (psutil.Error, OSError, TypeError):
            continue
    return False
