from __future__ import annotations

from chibi_overlay.riot.debug import sanitize_lcu_payload


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
