from chibi.riot.game.state import GameStateResolver
from chibi.riot.lcu.gameflow import normalize
from chibi.riot.lcu.models import GameState


def test_tft_process_and_window_force_in_game_over_lcu_lobby():
    resolved = GameStateResolver().resolve(normalize(connected=True, phase="Lobby"), tft_process=True, tft_window=True)
    assert resolved.state is GameState.IN_GAME
    assert resolved.details["state_source"] == "COMBINED"


def test_lcu_lobby_cannot_override_active_tft_window():
    resolver = GameStateResolver()
    first = resolver.resolve(normalize(connected=True, phase="InProgress"), tft_process=True, tft_window=True)
    second = resolver.resolve(normalize(connected=True, phase="Lobby"), tft_process=True, tft_window=True)
    assert first.state is second.state is GameState.IN_GAME


def test_tft_process_grace_period_prevents_lobby_flicker():
    clock = [10.0]
    resolver = GameStateResolver(grace_seconds=5.0, clock=lambda: clock[0])
    resolver.resolve(normalize(connected=True, phase="Lobby"), tft_process=True, tft_window=True)
    clock[0] = 13.0
    assert resolver.resolve(normalize(connected=True, phase="Lobby"), tft_process=False, tft_window=False).state is GameState.IN_GAME
    clock[0] = 16.0
    assert resolver.resolve(normalize(connected=True, phase="Lobby"), tft_process=False, tft_window=False).state is GameState.LOBBY


def test_postgame_wins_after_game_end():
    resolved = GameStateResolver().resolve(normalize(connected=True, phase="EndOfGame"), tft_process=True, tft_window=True)
    assert resolved.state is GameState.POST_GAME
