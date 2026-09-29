import json

from chibi.tracker.checkpoint import TFTCheckpointProvider
from chibi.tracker.events import EventType, TFTEvent
from chibi.tracker.heartbeat import TFTHeartbeatProvider
from chibi.tracker.input import event_for_gesture, event_for_position
from chibi.tracker.logs import TFTLogProvider, parse_log_line
from chibi.tracker.normalize import normalize_champion_id
from chibi.tracker.reducer import ChibiStateReducer


def test_normalizes_confirmed_champion_ids():
    assert normalize_champion_id("DA_18_Varus") == "Varus"
    assert normalize_champion_id("DA_18_Cassiopeia") == "Cassiopeia"
    assert normalize_champion_id("DA_Scuttlecrab18") == "Scuttlecrab18"


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


def test_reducer_keeps_speculative_history_and_checkpoint_is_authoritative():
    reducer = ChibiStateReducer("local")
    reducer.apply(TFTEvent(EventType.UNIT_PURCHASED, "TFT_LOG", {"rawId": "DA_18_Varus", "championId": "Varus"}))
    reducer.apply(TFTEvent(EventType.SHOP_REROLLED, "TFT_INPUT", confidence=0.92))
    state = reducer.apply(TFTEvent(EventType.CHECKPOINT_UPDATED, "TFT_CHECKPOINT", {"health": 55, "boardPieces": [{"championName": "DA_18_Cassiopeia", "starLevel": 2}], "augments": []}))
    assert state.purchases[0]["championId"] == "Varus"
    assert state.rerolls == 1
    assert state.board[0].champion_id == "Cassiopeia"
