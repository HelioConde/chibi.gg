from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class ChibiProfile:
    """Future Chibi API profile. It is intentionally separate from local Riot data."""

    puuid: str
    region: str = ""
    tft_rank: str = ""
    avatar_url: str = ""


@dataclass(frozen=True, slots=True)
class SessionResult:
    placement: int | None = None
    analysis_url: str = ""


class ChibiApiClient(Protocol):
    def get_profile(self, puuid: str) -> ChibiProfile | None: ...
    def create_session(self, session: object) -> None: ...
    def update_session(self, session: object) -> None: ...
    def get_latest_match(self, puuid: str) -> object | None: ...
    def get_session_result(self, session_id: str) -> SessionResult | None: ...


class LocalChibiApiClient:
    """Safe placeholder until the Chibi backend exposes an authenticated API contract."""

    def get_profile(self, puuid: str) -> ChibiProfile | None:
        return None

    def create_session(self, session: object) -> None:
        return None

    def update_session(self, session: object) -> None:
        return None

    def get_latest_match(self, puuid: str) -> object | None:
        return None

    def get_session_result(self, session_id: str) -> SessionResult | None:
        return None
