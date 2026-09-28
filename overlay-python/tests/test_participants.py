from __future__ import annotations

from chibi_overlay.riot.client import LcuClient


def test_session_participants_only_keep_present_non_competitive_fields() -> None:
    participants = LcuClient._participants(
        [
            {
                "puuid": "local-puuid",
                "summonerId": 42,
                "profileIconId": 123,
                "selectedSkinId": 9,
                "companionId": 77,
                "championId": 0,
            }
        ]
    )

    assert len(participants) == 1
    participant = participants[0]
    assert participant.puuid == "local-puuid"
    assert participant.summoner_id == 42
    assert participant.profile_icon_id == 123
    assert participant.cosmetics == {"selectedSkinId": 9, "companionId": 77}
    assert participant.is_local_player is False
