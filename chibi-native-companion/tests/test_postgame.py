from __future__ import annotations

from chibi.api.client import ChibiApiError
from chibi.api.models import HistoryMatch
from chibi.session.models import ChibiSession, SessionState
from chibi.session.postgame import PostGameManager, PostGameState


def history(match_id: str, played_at: int, queue_id: int = 1100) -> HistoryMatch:
    payload = {"id": match_id, "playedAt": played_at, "duration": 1800, "queueId": queue_id, "placement": 4, "level": 8, "goldLeft": 12, "damageToPlayers": 55, "playersEliminated": 2, "setNumber": 16, "setName": "TFT Set", "augments": [], "traits": [], "units": []}
    return HistoryMatch(match_id, played_at, 1800, queue_id, payload)


class Storage:
    def save(self, _session: ChibiSession) -> None: pass


class Api:
    def __init__(self, responses: list[object]) -> None: self.responses, self.calls = responses, 0
    def get_history(self, *_args: object) -> list[HistoryMatch]:
        value = self.responses[min(self.calls, len(self.responses) - 1)]; self.calls += 1
        if isinstance(value, list) and len(value) == 1 and isinstance(value[0], Exception): raise value[0]
        if isinstance(value, Exception): raise value
        return value  # type: ignore[return-value]
    def get_match(self, match_id: str) -> dict[str, object]: return {"match": {"id": match_id}}


def session() -> ChibiSession:
    return ChibiSession("session-1", "AlchemyFlames#br1", "focus", SessionState.WAITING_RESULT, queue_id=1100, game_started_at=1_700_000_000, game_ended_at=1_700_001_800, pre_game_match_ids=("old",))


def resolver(api: Api) -> PostGameManager:
    return PostGameManager(api=api, storage=Storage(), clock=lambda: 1_700_002_000, sleeper=lambda _seconds: None)


def test_postgame_finds_new_personal_match() -> None:
    result = resolver(Api([[history("old", 1_699_990_000), history("new", 1_700_000_100)]])).resolve(session())
    assert result and result.match_id == "new" and result.placement == 4


def test_postgame_never_selects_old_or_temporally_incompatible_match() -> None:
    current = session()
    result = resolver(Api([[history("old", 1_700_000_100), history("wrong-time", 1_600_000_000)]])).resolve(current)
    assert result is None
    assert current.postgame_status == PostGameState.RESULT_UNAVAILABLE.value


def test_rate_limit_retries_then_completes() -> None:
    current = session(); rate_limited = ChibiApiError(429, "rate_limited")
    result = resolver(Api([rate_limited, [history("new", 1_700_000_100)]])).resolve(current)
    assert result and current.poll_attempts == 2 and current.state is SessionState.COMPLETED
