from chibi.riot.lcu.models import GameState, GameStateSnapshot
from chibi.session.manager import SessionManager
from chibi.session.models import SessionState

def test_session_follows_gameflow():
    manager = SessionManager()
    for state in (GameState.MATCHMAKING, GameState.READY_CHECK, GameState.READY_CHECK_ACCEPTED, GameState.PREPARING, GameState.IN_GAME, GameState.POST_GAME):
        manager.on_gameflow(GameStateSnapshot(state, connected=True, riot_id="Tester#BR1"))
    assert manager.current and manager.current.state is SessionState.WAITING_RESULT
