from __future__ import annotations

import base64
import json
import os
import ssl
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen


class LcuUnavailableError(RuntimeError):
    """The League Client is closed or its local API cannot be reached."""


class LcuConnection:
    DEFAULT_LOCKFILES = (
        Path(r"C:\Riot Games\League of Legends\lockfile"),
        Path(r"C:\Program Files\Riot Games\League of Legends\lockfile"),
    )

    def __init__(self, lockfile_path: str | Path | None = None, timeout: float = 2) -> None:
        self.lockfile_path = Path(lockfile_path) if lockfile_path else None
        self.timeout = timeout

    def get_json(self, endpoint: str) -> object:
        lockfile = self._find_lockfile()
        try:
            _, _, port, password, protocol = lockfile.read_text(encoding="utf-8").strip().split(":")
        except (OSError, ValueError) as error:
            raise LcuUnavailableError("Não foi possível ler o lockfile do League Client.") from error
        if protocol != "https" or not port.isdigit() or not password:
            raise LcuUnavailableError("O lockfile do League Client está inválido.")

        token = base64.b64encode(f"riot:{password}".encode("utf-8")).decode("ascii")
        request = Request(
            f"https://127.0.0.1:{port}{endpoint}",
            headers={"Authorization": f"Basic {token}"},
        )
        try:
            with urlopen(request, context=ssl._create_unverified_context(), timeout=self.timeout) as response:
                return json.load(response)
        except (OSError, URLError, json.JSONDecodeError) as error:
            raise LcuUnavailableError("Não foi possível conectar à API local do League Client.") from error

    def _find_lockfile(self) -> Path:
        candidates: list[Path] = []
        if self.lockfile_path:
            candidates.append(self.lockfile_path)
        configured = os.environ.get("CHIBI_LEAGUE_LOCKFILE")
        if configured:
            candidates.append(Path(configured))
        candidates.extend(self.DEFAULT_LOCKFILES)
        for candidate in candidates:
            if candidate.is_file():
                return candidate
        raise LcuUnavailableError("League Client não encontrado.")
