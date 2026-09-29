from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.request import urlopen

from chibi.core.settings import app_data_dir


class TftAssets:
    """Small, public Data Dragon lookup cache used only for labels and artwork."""

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or app_data_dir() / "cache" / "tft-assets.json"
        self.version = ""
        self.entries: dict[str, dict[str, dict[str, str]]] = {"champion": {}, "item": {}, "trait": {}}

    def load_cache(self) -> "TftAssets":
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                self.version = str(raw.get("version") or "")
                rows = raw.get("entries")
                if isinstance(rows, dict):
                    self.entries = {kind: values for kind, values in rows.items() if kind in self.entries and isinstance(values, dict)}
        except (OSError, ValueError, TypeError):
            pass
        return self

    def fetch(self) -> "TftAssets":
        version = str(self._json("https://ddragon.leagueoflegends.com/api/versions.json")[0])
        base = f"https://ddragon.leagueoflegends.com/cdn/{version}/data/pt_BR/"
        entries = {
            "champion": self._parse(version, "champion", self._json(base + "tft-champion.json")),
            "item": self._parse(version, "item", self._json(base + "tft-item.json")),
            "trait": self._parse(version, "trait", self._json(base + "tft-trait.json")),
        }
        self.version, self.entries = version, entries
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps({"version": version, "entries": entries}, ensure_ascii=False), encoding="utf-8")
        return self

    @staticmethod
    def _json(url: str) -> Any:
        with urlopen(url, timeout=8) as response:
            return json.load(response)

    @staticmethod
    def _parse(version: str, kind: str, raw: Any) -> dict[str, dict[str, str]]:
        source = raw.get("data") if isinstance(raw, dict) else {}
        result: dict[str, dict[str, str]] = {}
        if not isinstance(source, dict):
            return result
        for key, value in source.items():
            if not isinstance(value, dict):
                continue
            image = value.get("image") if isinstance(value.get("image"), dict) else {}
            full = str(image.get("full") or "")
            entry = {"name": str(value.get("name") or key), "url": f"https://ddragon.leagueoflegends.com/cdn/{version}/img/tft-{kind}/{full}" if full else ""}
            for alias in (str(key), str(value.get("id") or "")):
                if alias:
                    result[alias] = entry
        return result

    def name(self, kind: str, identifier: str) -> str:
        return self.entries.get(kind, {}).get(identifier, {}).get("name") or identifier.rsplit("_", 1)[-1]

    def url(self, kind: str, identifier: str) -> str:
        return self.entries.get(kind, {}).get(identifier, {}).get("url") or ""
