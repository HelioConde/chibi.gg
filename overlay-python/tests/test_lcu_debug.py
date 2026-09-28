from __future__ import annotations

from chibi_overlay.riot.debug import extract_schema, sanitize_lcu_payload, schema_diff


def test_sanitized_lcu_payload_preserves_shape_without_sensitive_values() -> None:
    payload = {
        "gameData": {"playerChampionSelections": [{"championId": 10, "puuid": "secret"}]},
        "spectatorKey": "secret",
        "serverIp": "127.0.0.1",
        "queue": {"id": 1100},
    }

    sanitized = sanitize_lcu_payload(payload)

    assert sanitized == {
        "gameData": {"playerChampionSelections": [{"championId": 10, "puuid": "[redacted]"}]},
        "spectatorKey": "[redacted]",
        "serverIp": "[redacted]",
        "queue": {"id": 1100},
    }


def test_schema_extraction_has_types_and_list_lengths_without_sensitive_paths() -> None:
    schema = extract_schema(
        {
            "gameData": {"players": [{"championId": 10, "puuid": "private"}]},
            "serverPort": 1234,
        }
    )

    assert {entry["path"] for entry in schema} == {
        "gameData",
        "gameData.players",
        "gameData.players[]",
        "gameData.players[].championId",
    }
    players = next(entry for entry in schema if entry["path"] == "gameData.players")
    assert players["type"] == "list"
    assert players["list_length"] == 1


def test_schema_diff_reports_added_removed_type_and_list_size_changes() -> None:
    before = [
        {"path": "players", "type": "list", "count": 1, "list_length": 1},
        {"path": "old", "type": "int", "count": 1},
    ]
    after = [
        {"path": "players", "type": "list", "count": 1, "list_length": 2},
        {"path": "old", "type": "str", "count": 1},
        {"path": "new", "type": "bool", "count": 1},
    ]

    diff = schema_diff(before, after)

    assert diff["added"] == [{"path": "new", "type": "bool", "count": 1}]
    assert diff["removed"] == []
    assert diff["changed"] == [
        {"path": "old", "type": {"before": "int", "after": "str"}},
        {"path": "players", "list_length": {"before": 1, "after": 2}},
    ]
