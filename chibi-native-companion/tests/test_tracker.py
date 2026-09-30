import json

from chibi.tracker.checkpoint import TFTCheckpointProvider
from chibi.assets import TftAssets
from chibi.tracker.entities import TFTChampionResolver
from chibi.tracker.events import EventType, TFTEvent
from chibi.tracker.heartbeat import TFTHeartbeatProvider
from chibi.tracker.input import event_for_gesture, event_for_position
from chibi.tracker.liveclient import TFTLiveClientProvider
from chibi.tracker.logs import TFTLogProvider, parse_log_line
from chibi.tracker.normalize import normalize_champion_id
from chibi.tracker.reducer import ChibiStateReducer
from chibi.tracker.values import parse_round, valid_gold, valid_level
from chibi.tracker.vision import NormalizedRoi, TFTVisionLayout, VisionCaptureManager, vision_gold_provider
from chibi.vision.capture import CapturedFrame


def test_normalizes_confirmed_champion_ids():
    assert normalize_champion_id("DA_18_Varus") == "Varus"
    assert normalize_champion_id("DA_18_Cassiopeia") == "Cassiopeia"
    assert normalize_champion_id("DA_Scuttlecrab18") == "Scuttlecrab18"


def test_champion_resolver_uses_static_cache_and_preserves_unknown_raw_ids(tmp_path):
    path = tmp_path / "assets.json"
    path.write_text(json.dumps({"entries": {"champion": {
        "DA_18_Varus": {"name": "Varus"},
        "DA_18_Cassiopeia": {"name": "Cassiopeia"},
        "DA_Scuttlecrab18": {"name": "Scuttlecrab"},
    }, "item": {}, "trait": {}}}), encoding="utf-8")
    resolver = TFTChampionResolver(TftAssets(path))
    assert resolver.resolve("DA_18_Varus").display_name == "Varus"
    assert resolver.resolve("DA_18_Cassiopeia").canonical_id == "Cassiopeia"
    assert resolver.resolve("DA_Scuttlecrab18").display_name == "Scuttlecrab"
    assert resolver.resolve("DA_SteadfastHeart").display_name == "Leona"
    unknown = resolver.resolve("Future_Internal_Unit")
    assert unknown.raw_id == "Future_Internal_Unit" and not unknown.resolved


def test_heartbeat_reads_nested_riot_session_schema_and_emits_only_changes(tmp_path):
    root = tmp_path / "Sessions" / "session-1"
    root.mkdir(parents=True)
    path = root / "state.heartbeat.json"
    path.write_text(json.dumps({"source": {"productId": "teamfighttactics", "pid": 42}, "data": {"phase": "Gameplay"}}), encoding="utf-8")
    provider = TFTHeartbeatProvider(tmp_path / "Sessions")
    event = provider.poll()[0]
    assert event.payload == {"phase": "Gameplay", "pid": 42, "lifecycle": "game_running"}
    assert provider.poll() == []


def test_parses_purchase_and_star_up_events():
    purchase = parse_log_line("Audio.Event.VO.Unit.Purchase {DA_18_Varus}")[0]
    assert purchase.type is EventType.UNIT_PURCHASED
    assert purchase.payload["championId"] == "Varus"
    two = parse_log_line("Audio.Event.VO.Unit.StarUp.2Star {DA_18_Cassiopeia}")[0]
    three = parse_log_line("Audio.Event.VO.Unit.StarUp.3Star {DA_18_Cassiopeia}")[0]
    assert (two.type, two.payload["stars"], three.payload["stars"]) == (EventType.UNIT_STAR_UP, 2, 3)


def test_round_log_event_requires_a_valid_explicit_round_value():
    events = parse_log_line("TFTRoundSubsystem stage changed to 4-5")
    assert events[-1].type is EventType.ROUND_UPDATED
    assert events[-1].payload["value"] == "4-5"
    assert not parse_log_line("TFTRoundSubsystem stage changed to 99-99")


def test_input_regions_and_drag_heuristic():
    assert event_for_position(0.25, 0.96) is EventType.SHOP_REROLLED
    assert event_for_position(0.24, 0.87) is EventType.XP_PURCHASED
    assert event_for_gesture(0.25, 0.96, 0.2, 0.01) is EventType.SHOP_REROLLED
    assert event_for_gesture(0.25, 0.96, 0.7, 0.01) is None
    assert event_for_gesture(0.25, 0.96, 0.2, 0.05) is None


def test_log_reader_reads_appended_bytes_and_handles_truncate_and_rotation(tmp_path):
    root = tmp_path / "TFT" / "Logs"
    root.mkdir(parents=True)
    path = root / "TFT.log"
    path.write_text("historical line\n", encoding="utf-8")
    provider = TFTLogProvider(tmp_path / "TFT")
    assert provider.poll() == []
    with path.open("a", encoding="utf-8") as source:
        source.write("Audio.Event.VO.Unit.Purchase {DA_18_Varus}\n")
    assert [event.type for event in provider.poll()] == [EventType.UNIT_PURCHASED]
    path.write_text("Audio.Event.VO.Unit.StarUp.2Star {DA_18_Varus}\n", encoding="utf-8")
    assert [event.type for event in provider.poll()] == [EventType.UNIT_STAR_UP]
    path.rename(root / "TFT-old.log")
    path.write_text("Audio.Event.VO.Unit.StarUp.3Star {DA_18_Varus}\n", encoding="utf-8")
    assert [event.payload["stars"] for event in provider.poll()] == [3]


def test_checkpoint_reconciles_local_player_only_and_retries_incomplete_json(tmp_path):
    path = tmp_path / "Saved" / "Logs" / "TFTEoGStats.json"
    path.parent.mkdir(parents=True)
    provider = TFTCheckpointProvider("local", tmp_path)
    path.write_text("{", encoding="utf-8")
    assert provider.poll() == []
    path.write_text(json.dumps({"gameId": "game-1", "setCoreName": "Set18", "players": [
        {"PUUID": "other", "health": 99, "boardPieces": [{"championName": "DA_18_Varus"}]},
        {"PUUID": "local", "health": 62, "augments": ["Augment"], "boardPieces": [{"championName": "DA_18_Cassiopeia", "starLevel": 3, "itemNames": ["Item"]}]},
    ]}), encoding="utf-8")
    event = provider.poll()[0]
    reducer = ChibiStateReducer("local")
    state = reducer.apply(event)
    assert state.player.hp.value == 62
    assert state.board[0].champion_id == "Cassiopeia"
    assert state.board[0].stars == 3
    assert state.augments == ["Augment"]


def test_star_up_replaces_frozen_board_piece_without_crashing():
    reducer = ChibiStateReducer("local")
    reducer.apply(TFTEvent(
        EventType.CHECKPOINT_UPDATED,
        "TFT_CHECKPOINT",
        {"boardPieces": [{"championName": "DA_18_Cassiopeia", "starLevel": 1}]},
    ))
    original = reducer.state.board[0]
    state = reducer.apply(TFTEvent(
        EventType.UNIT_STAR_UP,
        "TFT_LOG",
        {"rawId": "DA_18_Cassiopeia", "championId": "Cassiopeia", "stars": 2},
    ))
    assert state.board[0].stars == 2
    assert state.board[0] is not original


def test_reducer_keeps_speculative_history_and_checkpoint_is_authoritative():
    reducer = ChibiStateReducer("local")
    reducer.apply(TFTEvent(EventType.UNIT_PURCHASED, "TFT_LOG", {"rawId": "DA_18_Varus", "championId": "Varus"}))
    reducer.apply(TFTEvent(EventType.SHOP_REROLLED, "TFT_INPUT", confidence=0.92))
    state = reducer.apply(TFTEvent(EventType.CHECKPOINT_UPDATED, "TFT_CHECKPOINT", {"health": 55, "boardPieces": [{"championName": "DA_18_Cassiopeia", "starLevel": 2}], "augments": []}))
    assert state.purchases[0]["championId"] == "Varus"
    assert state.rerolls == 1
    assert state.board[0].champion_id == "Cassiopeia"


def test_value_validators_and_source_precedence():
    assert not valid_level(0) and valid_level(1) and valid_level(10) and not valid_level(99)
    assert not valid_gold(-1) and valid_gold(0) and valid_gold(50) and valid_gold(999) and not valid_gold(1000)
    assert parse_round("2-1") == "2-1" and parse_round("4-5") == "4-5" and parse_round("round 4-5") is None
    reducer = ChibiStateReducer()
    reducer.apply(TFTEvent(EventType.LEVEL_UPDATED, "LIVE_CLIENT", {"value": 6}, confidence=1.0))
    state = reducer.apply(TFTEvent(EventType.LEVEL_UPDATED, "VISION", {"value": 5}, confidence=0.99))
    assert state.player.level.value == 6 and state.player.level.source == "LIVE_CLIENT"


def test_roi_scales_with_capture_size_and_vision_is_disabled_outside_game():
    roi = NormalizedRoi(0.50, 0.79, 0.07, 0.07)
    assert roi.bounds(1600, 900) == (800, 711, 112, 63)
    assert roi.bounds(2560, 1440) == (1280, 1138, 179, 101)
    provider = vision_gold_provider(lambda: "lobby")
    assert provider.poll() == [] and provider.status == "disabled"


def test_vision_provider_rejects_low_confidence_and_confirms_unstable_changes():
    clock = [0.0]
    readings = iter([("48", .96), ("488", .51), ("48", .97), ("50", .80), ("50", .81)])
    provider = vision_gold_provider(lambda: "game_running", reader=lambda _roi: next(readings))
    provider.clock = lambda: clock[0]
    assert provider.poll()[0].payload["value"] == 48
    clock[0] += 1
    assert provider.poll() == [] and provider.status == "low_confidence"
    clock[0] += 1
    assert provider.poll() == []  # The trusted value did not change.
    clock[0] += 1
    assert provider.poll() == [] and provider.status == "calibrating"
    clock[0] += 1
    assert provider.poll()[0].payload["value"] == 50


def test_capture_manager_shares_frame_saves_deduplicated_samples_and_recovers(tmp_path):
    rgb = bytes([20, 40, 60] * 100)

    class FakeCapture:
        def capture(self, _window):
            return CapturedFrame(10, 10, 12.0, rgb)

    class FakeOcr:
        def read(self, _rgb, _width, _height):
            return "42", .95

    manager = VisionCaptureManager(
        lambda: "game_running", calibrate=True, capture=FakeCapture(),
        window_provider=lambda: object(), ocr=FakeOcr(), root=tmp_path, max_fps=100,
    )
    manager.poll()
    assert manager.status == "capturing"
    value = manager.reader("gold", TFTVisionLayout.GOLD)(TFTVisionLayout.GOLD)
    assert value == ("42", .95)
    manager.reader("gold", TFTVisionLayout.GOLD)(TFTVisionLayout.GOLD)
    assert manager.diagnostics["samples"] == {"gold": 1, "level": 0, "round": 0}
    assert (tmp_path / "frame-latest.png").exists() and (tmp_path / "layout-latest.png").exists()


def test_capture_manager_is_safe_when_window_or_capture_is_unavailable(tmp_path):
    manager = VisionCaptureManager(lambda: "game_running", window_provider=lambda: None, root=tmp_path)
    assert manager.poll() == [] and manager.status == "waiting_for_game"

    class BrokenCapture:
        def capture(self, _window):
            raise RuntimeError("no capture")

    manager = VisionCaptureManager(lambda: "game_running", capture=BrokenCapture(), window_provider=lambda: object(), root=tmp_path)
    assert manager.poll() == [] and manager.status == "unavailable"


def test_live_client_backs_off_then_recovers_without_crashing():
    now = [0.0]
    responses: list[object] = [OSError("closed"), {"activePlayer": {"level": 6, "currentGold": 42}}]

    def fetch():
        value = responses.pop(0)
        if isinstance(value, Exception):
            raise value
        return value

    provider = TFTLiveClientProvider(fetch=fetch, clock=lambda: now[0])
    assert provider.poll() == [] and provider.status == "unavailable"
    assert provider.poll() == []  # Still within the first backoff window.
    now[0] = 1.0
    events = provider.poll()
    assert provider.status == "connected"
    assert {(event.type, event.payload["value"]) for event in events} == {
        (EventType.LEVEL_UPDATED, 6), (EventType.GOLD_UPDATED, 42)
    }


def test_live_client_partial_payload_and_timeout_are_safe():
    timeout = TFTLiveClientProvider(fetch=lambda: TimeoutError("timed out"))
    # A provider exception is represented as unavailable, never leaked to the UI loop.
    def timed_out():
        raise TimeoutError("timed out")
    timeout.fetch = timed_out
    assert timeout.poll() == [] and timeout.status == "unavailable"
    partial = TFTLiveClientProvider(fetch=lambda: {"activePlayer": {"level": None}})
    assert partial.poll() == [] and partial.status == "connected"
