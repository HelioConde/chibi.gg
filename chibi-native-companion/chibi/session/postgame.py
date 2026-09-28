from __future__ import annotations
import logging
from concurrent.futures import ThreadPoolExecutor
from enum import Enum
from time import sleep, time

from chibi.api.client import ChibiApiClient, ChibiApiError
from chibi.api.models import HistoryMatch, MatchResult
from chibi.debug.reports import postgame_report
from PySide6.QtCore import QObject, Signal
from .models import ChibiSession, SessionState
from .storage import SessionStorage

LOGGER = logging.getLogger("chibi.native.postgame")
DELAYS = (5, 10, 15, 30, 30, 30)

class PostGameState(str, Enum):
    WAITING_FOR_MATCH = "waiting_for_match"
    FETCHING_MATCH = "fetching_match"
    MATCH_FOUND = "match_found"
    COMPLETED = "completed"
    RESULT_UNAVAILABLE = "result_unavailable"
    ERROR = "error"

class PostGameManager:
    def __init__(self, api: ChibiApiClient | None = None, storage: SessionStorage | None = None, clock=time, sleeper=sleep) -> None:
        self.api, self.storage, self.clock, self.sleeper = api or ChibiApiClient(), storage or SessionStorage(), clock, sleeper
    def capture_pre_game(self, session: ChibiSession) -> None:
        game_name, tag_line = split_riot_id(session.riot_id)
        if not game_name or not tag_line: return
        try:
            session.pre_game_match_ids = tuple(match.id for match in self.api.get_history(game_name, tag_line, session.platform))
            self.storage.save(session)
            LOGGER.info("[POSTGAME] captured pre-game history count=%s", len(session.pre_game_match_ids))
        except ChibiApiError as error:
            LOGGER.info("[POSTGAME] pre-game history unavailable code=%s", error.code)
    def resolve(self, session: ChibiSession) -> MatchResult | None:
        session.postgame_status = PostGameState.WAITING_FOR_MATCH.value; self.storage.save(session); LOGGER.info("[POSTGAME] waiting for result")
        started = self.clock()
        for delay in DELAYS:
            session.poll_attempts += 1; self.storage.save(session); LOGGER.info("[POSTGAME] history poll %s", session.poll_attempts)
            try:
                candidate = self._find_candidate(session)
                if candidate is None:
                    LOGGER.info("[POSTGAME] no new match")
                else:
                    session.postgame_status = PostGameState.MATCH_FOUND.value; self.storage.save(session)
                    LOGGER.info("[POSTGAME] match found")
                    session.postgame_status = PostGameState.FETCHING_MATCH.value; self.storage.save(session)
                    detail = self.api.get_match(candidate.id)
                    result = to_result(candidate, detail)
                    session.match_id, session.result = result.match_id, result_to_dict(result)
                    session.state, session.postgame_status, session.completed_at = SessionState.COMPLETED, PostGameState.COMPLETED.value, self.clock()
                    self.storage.save(session); postgame_report(session, elapsed_seconds=self.clock() - started)
                    LOGGER.info("[POSTGAME] completed")
                    return result
            except ChibiApiError as error:
                if error.status == 429:
                    LOGGER.info("[POSTGAME] rate limited")
                elif error.status in {404, 502, 503}:
                    LOGGER.info("[POSTGAME] backend pending code=%s", error.code)
                else:
                    session.postgame_status = PostGameState.ERROR.value; self.storage.save(session); postgame_report(session, elapsed_seconds=self.clock() - started, error=error.code); return None
            self.sleeper(delay)
        session.postgame_status = PostGameState.RESULT_UNAVAILABLE.value; self.storage.save(session); postgame_report(session, elapsed_seconds=self.clock() - started)
        LOGGER.info("[POSTGAME] result unavailable")
        return None
    def _find_candidate(self, session: ChibiSession) -> HistoryMatch | None:
        game_name, tag_line = split_riot_id(session.riot_id)
        if not game_name or not tag_line: return None
        for match in self.api.get_history(game_name, tag_line, session.platform):
            if match.id in session.pre_game_match_ids: continue
            if session.queue_id is not None and match.queue_id and match.queue_id != session.queue_id: continue
            if temporal_match(session, match): return match
        return None

def split_riot_id(riot_id: str) -> tuple[str, str]:
    name, marker, tag = riot_id.partition("#"); return name, tag if marker else ""

def epoch_seconds(value: int) -> float: return value / 1000 if value > 100_000_000_000 else float(value)

def temporal_match(session: ChibiSession, match: HistoryMatch) -> bool:
    if not session.game_started_at and not session.game_ended_at: return False
    started, ended = epoch_seconds(match.played_at), epoch_seconds(match.played_at) + max(0.0, match.duration)
    if session.game_started_at and ended < session.game_started_at - 120: return False
    if session.game_ended_at and started > session.game_ended_at + 120: return False
    return True

def to_result(history: HistoryMatch, detail: dict[str, object]) -> MatchResult:
    payload = history.payload
    match = detail.get("match") if isinstance(detail.get("match"), dict) else {}
    if str(match.get("id") or history.id) != history.id: raise ChibiApiError(None, "match_id_mismatch")
    integer = lambda value: int(value) if isinstance(value, (int, float)) else 0
    number = lambda value: float(value) if isinstance(value, (int, float)) else None
    return MatchResult(history.id, integer(payload.get("placement")), integer(payload.get("level")), integer(payload.get("goldLeft")), integer(payload.get("lastRound")) if payload.get("lastRound") is not None else None, number(payload.get("timeEliminated")), integer(payload.get("damageToPlayers")), integer(payload.get("playersEliminated")), integer(payload.get("setNumber")), str(payload.get("setName") or ""), integer(payload.get("queueId")), history.played_at, history.duration, tuple(item for item in payload.get("augments", []) if isinstance(item, str)) if isinstance(payload.get("augments"), list) else (), tuple(item for item in payload.get("traits", []) if isinstance(item, dict)) if isinstance(payload.get("traits"), list) else (), tuple(item for item in payload.get("units", []) if isinstance(item, dict)) if isinstance(payload.get("units"), list) else ())

def result_to_dict(result: MatchResult) -> dict[str, object]:
    return {"match_id": result.match_id, "placement": result.placement, "level": result.level, "gold_left": result.gold_left, "last_round": result.last_round, "time_eliminated": result.time_eliminated, "damage_to_players": result.damage_to_players, "players_eliminated": result.players_eliminated, "set_number": result.set_number, "set_name": result.set_name, "queue_id": result.queue_id, "played_at": result.played_at, "duration": result.duration, "augments": list(result.augments), "traits": list(result.traits), "units": list(result.units)}

class PostGameController(QObject):
    """Runs public-history polling away from the Qt event loop."""
    completed = Signal(object, object)
    unavailable = Signal(object)

    def __init__(self, manager: PostGameManager | None = None) -> None:
        super().__init__(); self.manager = manager or PostGameManager(); self.pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="chibi-postgame"); self.in_flight: set[str] = set()

    def capture_pre_game(self, session: ChibiSession) -> None:
        self.pool.submit(self.manager.capture_pre_game, session)

    def resolve(self, session: ChibiSession) -> None:
        if session.id in self.in_flight: return
        self.in_flight.add(session.id)
        future = self.pool.submit(self.manager.resolve, session)
        def finished(done: object) -> None:
            self.in_flight.discard(session.id)
            try: result = future.result()
            except Exception:  # the app must stay alive if a future fails unexpectedly
                LOGGER.exception("[POSTGAME] background resolver failed"); result = None
            if result: self.completed.emit(session, result)
            else: self.unavailable.emit(session)
        future.add_done_callback(finished)

    def stop(self) -> None: self.pool.shutdown(wait=False, cancel_futures=True)
