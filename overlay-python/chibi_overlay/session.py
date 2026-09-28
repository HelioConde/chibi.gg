from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Any
from uuid import uuid4

from PySide6.QtCore import QObject, Signal, Slot

from .chibi_api import ChibiApiClient, LocalChibiApiClient, SessionResult
from .riot.models import GameState, GameStateSnapshot
from .storage import LocalStore


LOGGER = logging.getLogger("chibi.session")


class ChibiSessionState(str, Enum):
    IDLE = "idle"
    QUEUEING = "queueing"
    READY = "ready"
    STARTING = "starting"
    IN_GAME = "in_game"
    WAITING_RESULT = "waiting_result"
    COMPLETED = "completed"
    ABORTED = "aborted"


@dataclass(frozen=True, slots=True)
class SessionFocus:
    id: str
    label: str
    description: str


SESSION_FOCUSES: tuple[SessionFocus, ...] = (
    SessionFocus("economy", "Economia", "Evitar gastar ouro sem um motivo claro."),
    SessionFocus("positioning", "Posicionamento", "Rever posicionamento antes dos combates importantes."),
    SessionFocus("flexibility", "Flexibilidade", "Evitar forçar composição cedo demais."),
    SessionFocus("items", "Itens", "Jogar em torno dos itens que aparecerem."),
    SessionFocus("tempo", "Tempo de decisão", "Reduzir decisões apressadas."),
)


@dataclass(slots=True)
class RiotLocalProfile:
    game_name: str = ""
    tag_line: str = ""
    puuid: str = ""
    profile_icon_id: int | None = None


@dataclass(slots=True)
class ChibiSession:
    id: str
    player_puuid: str
    game_name: str
    tag_line: str
    region: str
    created_at: datetime
    queue_started_at: datetime | None = None
    ready_check_at: datetime | None = None
    game_started_at: datetime | None = None
    game_ended_at: datetime | None = None
    queue_id: int | None = None
    queue_name: str | None = None
    ranked: bool | None = None
    participant_count: int | None = None
    focus_id: str | None = None
    focus_label: str | None = None
    focus_description: str | None = None
    state: ChibiSessionState = ChibiSessionState.IDLE
    result: SessionResult | None = None
    next_result_poll_at: datetime | None = None
    result_poll_count: int = 0
    result_unavailable: bool = False

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        for key in (
            "created_at",
            "queue_started_at",
            "ready_check_at",
            "game_started_at",
            "game_ended_at",
            "next_result_poll_at",
        ):
            value = data[key]
            data[key] = value.isoformat() if value else None
        data["state"] = self.state.value
        return data


class SessionManager(QObject):
    """Owns Chibi session lifecycle; the overlay only observes its output."""

    updated = Signal(object, object)

    def __init__(
        self,
        store: LocalStore,
        api_client: ChibiApiClient | None = None,
        parent: QObject | None = None,
    ) -> None:
        super().__init__(parent)
        self.store = store
        self.api = api_client or LocalChibiApiClient()
        self.current: ChibiSession | None = None
        self.selected_focus = self._focus_from_settings()
        self.previous_game_state = GameState.CLIENT_OFFLINE

    def _focus_from_settings(self) -> SessionFocus:
        settings = self.store.load_settings()
        focus_id = str(settings.get("last_focus", "flexibility"))
        if focus_id == "custom" and str(settings.get("custom_focus", "")).strip():
            return SessionFocus("custom", "Personalizado", str(settings["custom_focus"]).strip()[:180])
        return next((focus for focus in SESSION_FOCUSES if focus.id == focus_id), SESSION_FOCUSES[2])

    def set_focus(self, focus: SessionFocus) -> None:
        self.selected_focus = focus
        self.store.update_settings({"last_focus": focus.id, "custom_focus": ""})
        LOGGER.info("[SESSION] focus=%s", focus.id)

    def set_custom_focus(self, description: str) -> None:
        description = description.strip()[:180]
        if not description:
            return
        self.selected_focus = SessionFocus("custom", "Personalizado", description)
        self.store.update_settings({"last_focus": "custom", "custom_focus": description})
        LOGGER.info("[SESSION] focus=custom")

    @Slot(object)
    def on_gameflow(self, snapshot: GameStateSnapshot) -> None:
        previous = self.previous_game_state
        self.previous_game_state = snapshot.state
        if snapshot.state is GameState.MATCHMAKING and previous is not GameState.MATCHMAKING:
            self._create_if_needed(snapshot)

        session = self.current
        if session is not None:
            self._update_session_for_state(session, snapshot, previous)
        self.updated.emit(snapshot, self.current)

    def _create_if_needed(self, snapshot: GameStateSnapshot) -> None:
        if self.current and self.current.state in {
            ChibiSessionState.QUEUEING,
            ChibiSessionState.READY,
            ChibiSessionState.STARTING,
            ChibiSessionState.IN_GAME,
        }:
            return
        game_name, tag_line = self._split_riot_id(snapshot.riot_id)
        now = self._now()
        self.current = ChibiSession(
            id=str(uuid4()),
            player_puuid=snapshot.player_puuid,
            game_name=game_name,
            tag_line=tag_line,
            region="",
            created_at=now,
            queue_started_at=now,
            queue_id=snapshot.queue_id,
            queue_name=snapshot.queue_name or None,
            ranked=bool(snapshot.details.get("is_ranked", False)),
            participant_count=self._player_count(snapshot),
            focus_id=self.selected_focus.id,
            focus_label=self.selected_focus.label,
            focus_description=self.selected_focus.description,
            state=ChibiSessionState.QUEUEING,
        )
        self._persist("created")
        self.api.create_session(self.current)

    def _update_session_for_state(
        self,
        session: ChibiSession,
        snapshot: GameStateSnapshot,
        previous: GameState,
    ) -> None:
        now = self._now()
        state_map = {
            GameState.MATCHMAKING: ChibiSessionState.QUEUEING,
            GameState.READY_CHECK: ChibiSessionState.READY,
            GameState.READY_CHECK_ACCEPTED: ChibiSessionState.STARTING,
            GameState.CHAMP_SELECT: ChibiSessionState.STARTING,
            GameState.IN_GAME: ChibiSessionState.IN_GAME,
            GameState.POST_GAME: ChibiSessionState.WAITING_RESULT,
        }
        target = state_map.get(snapshot.state)
        if target:
            session.state = target
            session.queue_id = snapshot.queue_id or session.queue_id
            session.queue_name = snapshot.queue_name or session.queue_name
            session.ranked = bool(snapshot.details.get("is_ranked", session.ranked))
            session.participant_count = self._player_count(snapshot) or session.participant_count
            if target is ChibiSessionState.READY and session.ready_check_at is None:
                session.ready_check_at = now
            if target is ChibiSessionState.IN_GAME and session.game_started_at is None:
                session.game_started_at = now
                LOGGER.info("[SESSION] game_started")
            if target is ChibiSessionState.WAITING_RESULT and session.game_ended_at is None:
                session.game_ended_at = now
                session.next_result_poll_at = now
                LOGGER.info("[SESSION] game_ended")
            self._persist(target.value)
            self.api.update_session(session)
            return

        if snapshot.state is GameState.LOBBY and session.state in {
            ChibiSessionState.QUEUEING,
            ChibiSessionState.READY,
            ChibiSessionState.STARTING,
        }:
            session.state = ChibiSessionState.ABORTED
            self._persist("aborted")
            self.api.update_session(session)

    def poll_result(self) -> SessionResult | None:
        session = self.current
        if not session or session.state is not ChibiSessionState.WAITING_RESULT:
            return None
        now = self._now()
        if session.game_ended_at and now - session.game_ended_at >= timedelta(minutes=3):
            if not session.result_unavailable:
                session.result_unavailable = True
                self._persist("result_unavailable")
            return None
        if session.next_result_poll_at and now < session.next_result_poll_at:
            return None
        result = self.api.get_session_result(session.id)
        session.result_poll_count += 1
        delays = (5, 10, 15, 30)
        delay = delays[min(session.result_poll_count - 1, len(delays) - 1)]
        session.next_result_poll_at = now.replace(microsecond=0) + timedelta(seconds=delay)
        if result:
            session.result = result
            session.state = ChibiSessionState.COMPLETED
            LOGGER.info("[SESSION] result_found")
            self._persist("completed")
            self.api.update_session(session)
        else:
            LOGGER.debug("[SESSION] waiting_result poll=%s", session.result_poll_count)
            self._persist("waiting_result")
        return result

    def retry_result(self) -> None:
        session = self.current
        if not session or session.state is not ChibiSessionState.WAITING_RESULT:
            return
        session.result_unavailable = False
        session.game_ended_at = self._now()
        session.next_result_poll_at = session.game_ended_at
        session.result_poll_count = 0
        self._persist("retry_result")

    def _persist(self, event: str) -> None:
        if not self.current:
            return
        self.store.save_session(self.current.to_dict())
        LOGGER.info("[SESSION] %s", event)

    @staticmethod
    def _split_riot_id(riot_id: str) -> tuple[str, str]:
        game_name, separator, tag_line = riot_id.partition("#")
        return game_name, tag_line if separator else ""

    @staticmethod
    def _player_count(snapshot: GameStateSnapshot) -> int | None:
        value = snapshot.details.get("player_count")
        return value if isinstance(value, int) and value > 0 else None

    @staticmethod
    def _now() -> datetime:
        return datetime.now(UTC)
