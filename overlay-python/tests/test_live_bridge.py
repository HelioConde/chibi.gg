from __future__ import annotations

import asyncio
import json
from time import sleep

from websockets.asyncio.client import connect

from chibi_overlay.live_bridge.server import LiveBridgeServer
from chibi_overlay.live_bridge.state import TelemetryState
from chibi_overlay.live_bridge.debug_report import OverwolfDebugReport


def message(data: dict[str, object], version: int = 1) -> dict[str, object]:
    return {"type": "tft_live_snapshot", "version": version, "timestamp": 1_000_000, "data": data}


def test_partial_telemetry_snapshot_keeps_only_available_values() -> None:
    state = TelemetryState()
    assert state.receive({"type": "hello", "version": 1})
    assert state.receive(message({"gameRunning": True, "me": {"gold": 42}}))

    telemetry = state.telemetry
    assert telemetry.connected is True
    assert telemetry.gold.value == 42
    assert telemetry.gold.available is True
    assert telemetry.hp.available is False
    assert telemetry.board.available is False


def test_units_parse_without_assuming_missing_optional_fields() -> None:
    state = TelemetryState()
    assert state.receive(message({"board": [{"id": "TFT_Test", "items": ["Item_A", 2]}]}))

    unit = state.telemetry.board.value[0] if state.telemetry.board.value else None
    assert unit is not None
    assert unit.id == "TFT_Test"
    assert unit.name is None
    assert unit.items == ("Item_A",)


def test_invalid_or_wrong_version_messages_are_rejected() -> None:
    state = TelemetryState()
    assert state.receive("not-json") is False
    assert state.receive(message({}, version=2)) is False


def test_stale_values_are_marked_after_timeout() -> None:
    state = TelemetryState(stale_after_seconds=5)
    assert state.receive(message({"me": {"gold": 42}}))
    telemetry = state.refresh_staleness(now=1_006)
    assert telemetry.gold.stale is True


def test_overwolf_report_captures_only_overwolf_validation_messages(tmp_path) -> None:
    report = OverwolfDebugReport(tmp_path)
    report.receive({"type": "hello", "data": {"source": "chibi-overwolf"}})
    report.receive({"type": "overwolf_game_status", "data": {"gameRunning": True, "gameId": 5426}})
    report.receive({"type": "gep_debug", "data": {"kind": "first_payload", "feature": "me", "payload": {"gold": "42"}}})
    report.receive({"type": "tft_live_snapshot", "data": {"me": {"gold": 42}, "stage": "3-2", "board": []}})
    assert json.loads((tmp_path / "me.first.json").read_text(encoding="utf-8"))["gold"] == "42"
    validation = json.loads((tmp_path / "overwolf-validation-report.json").read_text(encoding="utf-8"))
    assert validation["game_detected"] is True
    assert validation["observed"]["gold"] is True
    assert validation["observed"]["stage"] is True


def test_loopback_server_handshake_and_reconnect() -> None:
    server = LiveBridgeServer(port=8876)
    server.start()
    sleep(0.1)

    async def exchange() -> None:
        async with connect("ws://127.0.0.1:8876") as socket:
            await socket.send(json.dumps({"type": "hello", "version": 1, "timestamp": 1}))
            assert json.loads(await socket.recv())["type"] == "hello_ack"
        async with connect("ws://127.0.0.1:8876") as socket:
            await socket.send("not-json")
            assert json.loads(await socket.recv())["message"] == "invalid_json"

    try:
        asyncio.run(exchange())
    finally:
        server.stop()
