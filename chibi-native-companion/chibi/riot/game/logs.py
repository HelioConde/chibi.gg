from __future__ import annotations
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable
from .process import RiotProcess

@dataclass(frozen=True, slots=True)
class GameLogSource:
    path: str; size: int
    def to_dict(self) -> dict[str, object]: return asdict(self)

def discover_logs(processes: Iterable[RiotProcess]) -> list[GameLogSource]:
    roots: set[Path] = set(); configured = os.environ.get("CHIBI_RIOT_LOG_DIR")
    if configured: roots.add(Path(configured))
    for process in processes:
        if process.executable:
            executable = Path(process.executable); roots.update((executable.parent / "Logs", executable.parent.parent / "Logs"))
    files: list[GameLogSource] = []
    for root in roots:
        try:
            if root.is_dir(): files.extend(GameLogSource(str(path), path.stat().st_size) for path in root.rglob("*.log") if path.is_file())
        except OSError: continue
    return sorted(files, key=lambda item: item.path.casefold())[:100]
