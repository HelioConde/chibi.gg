import pytest
from chibi.riot.lcu.gameflow import normalize
from chibi.riot.lcu.models import GameState

@pytest.mark.parametrize(("phase", "response", "state"), [("Lobby", None, GameState.LOBBY), ("Matchmaking", None, GameState.MATCHMAKING), ("ReadyCheck", None, GameState.READY_CHECK), ("ReadyCheck", "Accepted", GameState.READY_CHECK_ACCEPTED), ("ReadyCheck", "Declined", GameState.READY_CHECK_DECLINED), ("ChampSelect", None, GameState.PREPARING), ("InProgress", None, GameState.IN_GAME), ("EndOfGame", None, GameState.POST_GAME)])
def test_lcu_phase_normalization(phase, response, state):
    assert normalize(connected=True, phase=phase, response=response).state is state

def test_closed_client_is_offline(): assert normalize(connected=False).state is GameState.CLIENT_OFFLINE
