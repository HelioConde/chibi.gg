from __future__ import annotations

import base64
import json
import os
import ssl
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen


class LcuUnavailableError(RuntimeError):
    pass


class LcuConnection:
    """LCU loopback transport. Credentials stay in memory and never enter logs/settings."""
    DEFAULT_LOCKFILES = (Path(r"C:\Riot Games\League of Legends\lockfile"), Path(r"C:\Program Files\Riot Games\League of Legends\lockfile"))

    def __init__(self, lockfile: str | Path | None = None, timeout: float = 2.0) -> None:
        self.lockfile = Path(lockfile) if lockfile else None
        self.timeout = timeout

    def get_json(self, endpoint: str) -> object:
        path = self._find_lockfile()
        try:
            _, _, port, password, protocol = path.read_text(encoding="utf-8").strip().split(":")
        except (OSError, ValueError) as error:
            raise LcuUnavailableError("lockfile inválido") from error
        if protocol != "https" or not port.isdigit() or not password:
            raise LcuUnavailableError("lockfile inválido")
        token = base64.b64encode(f"riot:{password}".encode()).decode()
        request = Request(f"https://127.0.0.1:{port}{endpoint}", headers={"Authorization": f"Basic {token}"})
        try:
            with urlopen(request, context=ssl._create_unverified_context(), timeout=self.timeout) as response:
                return json.load(response)
        except (OSError, URLError, ValueError) as error:
            raise LcuUnavailableError("LCU indisponível") from error

    def _find_lockfile(self) -> Path:
        candidates = [self.lockfile] if self.lockfile else []
        configured = os.environ.get("CHIBI_LEAGUE_LOCKFILE")
        if configured:
            candidates.append(Path(configured))
        candidates.extend(self.DEFAULT_LOCKFILES)
        for candidate in candidates:
            if candidate and candidate.is_file():
                return candidate
        raise LcuUnavailableError("League Client não encontrado")
