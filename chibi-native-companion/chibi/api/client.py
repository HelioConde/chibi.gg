from __future__ import annotations
import json
import os
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_BASE = "https://pbosggnpdzrirjhuswkj.supabase.co/functions/v1"

class ChibiApiError(RuntimeError):
    def __init__(self, status: int | None, code: str, message: str = "") -> None:
        super().__init__(message or code); self.status, self.code = status, code

class ChibiApiClient:
    """Calls only public Chibi Edge Functions; no key or credential is embedded."""
    def __init__(self, base_url: str | None = None, timeout: float = 10.0) -> None:
        self.base_url = (base_url or os.environ.get("CHIBI_API_BASE") or DEFAULT_BASE).rstrip("/")
        self.timeout = timeout
    def get_profile(self, game_name: str, tag_line: str, platform: str) -> dict[str, object]:
        return self._post("public-tft-profile", {"gameName": game_name, "tagLine": tag_line, "platform": platform})
    def get_history(self, game_name: str, tag_line: str, platform: str, start: int = 0, count: int = 10) -> list[HistoryMatch]:
        data = self._post("public-tft-history", {"gameName": game_name, "tagLine": tag_line, "platform": platform, "start": start, "count": count})
        raw = data.get("matches") if isinstance(data.get("matches"), list) else []
        return [HistoryMatch(str(item.get("id") or ""), _integer(item.get("playedAt")), _number(item.get("duration")), _integer(item.get("queueId")), item) for item in raw if isinstance(item, dict) and item.get("id")]
    def get_match(self, match_id: str) -> dict[str, object]:
        return self._post("public-tft-match", {"matchId": match_id})
    def _post(self, function: str, body: dict[str, object]) -> dict[str, object]:
        request = Request(f"{self.base_url}/{function}", data=json.dumps(body).encode("utf-8"), headers={"Content-Type": "application/json", "User-Agent": "ChibiNativeCompanion/0.1"}, method="POST")
        try:
            with urlopen(request, timeout=self.timeout) as response:
                data = json.load(response)
        except HTTPError as error:
            try: data = json.load(error)
            except (ValueError, OSError): data = {}
            raise ChibiApiError(error.code, str(data.get("error") or "http_error"), str(data.get("message") or "")) from error
        except (URLError, OSError, ValueError) as error:
            raise ChibiApiError(None, "network_error", "Não foi possível consultar o Chibi.") from error
        if not isinstance(data, dict): raise ChibiApiError(None, "invalid_response")
        if data.get("error"): raise ChibiApiError(None, str(data["error"]), str(data.get("message") or ""))
        return data

def _integer(value: object) -> int:
    try: return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError): return 0
def _number(value: object) -> float:
    try: return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError): return 0.0
