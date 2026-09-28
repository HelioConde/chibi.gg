from __future__ import annotations

from dataclasses import dataclass, field

from chibi_overlay.riot.models import GameState, GameStateSnapshot
from chibi_overlay.session import ChibiSessionState, SESSION_FOCUSES, SessionManager


@dataclass
class MemoryStore:
    settings: dict[str, object] = field(default_factory=dict)
    saved_sessions: list[dict[str, object]] = field(default_factory=list)

    def load_settings(self) -> dict[str, object]:
        return dict(self.settings)

    def update_settings(self, updates: dict[str, object]) -> None:
        self.settings.update(updates)

    def save_session(self, session: dict[str, object]) -> None:
        self.saved_sessions.append(dict(session))


def snapshot(state: GameState) -> GameStateSnapshot:
    return GameStateSnapshot(
        state=state,
        riot_id="Tester#BR1",
        player_puuid="player-puuid",
        queue_id=1100,
        queue_name="Teamfight Tactics (ranqueada)",
        connected=True,
        details={"game_mode": "TFT", "is_ranked": True, "player_count": 8},
    )


def test_session_lifecycle_reaches_waiting_result() -> None:
    manager = SessionManager(MemoryStore())  # type: ignore[arg-type]
    for state in (
        GameState.LOBBY,
        GameState.MATCHMAKING,
        GameState.READY_CHECK,
        GameState.READY_CHECK_ACCEPTED,
        GameState.CHAMP_SELECT,
        GameState.IN_GAME,
        GameState.POST_GAME,
    ):
        manager.on_gameflow(snapshot(state))

    session = manager.current
    assert session is not None
    assert session.state is ChibiSessionState.WAITING_RESULT
    assert session.game_started_at is not None
    assert session.game_ended_at is not None
    assert session.player_puuid == "player-puuid"
    assert session.participant_count == 8


def test_cancelled_queue_is_aborted() -> None:
    manager = SessionManager(MemoryStore())  # type: ignore[arg-type]
    manager.on_gameflow(snapshot(GameState.MATCHMAKING))
    manager.on_gameflow(snapshot(GameState.LOBBY))

    assert manager.current is not None
    assert manager.current.state is ChibiSessionState.ABORTED


def test_selected_focus_is_copied_into_new_session() -> None:
    manager = SessionManager(MemoryStore())  # type: ignore[arg-type]
    flexibility = next(focus for focus in SESSION_FOCUSES if focus.id == "flexibility")
    manager.set_focus(flexibility)
    manager.on_gameflow(snapshot(GameState.MATCHMAKING))

    assert manager.current is not None
    assert manager.current.focus_id == "flexibility"
    assert manager.current.focus_description == "Evitar forçar composição cedo demais."
