from __future__ import annotations

from dataclasses import dataclass

from chibi.assets import TftAssets

from .normalize import normalize_champion_id


@dataclass(frozen=True, slots=True)
class ResolvedEntity:
    raw_id: str
    api_name: str | None
    canonical_id: str | None
    display_name: str
    resolved: bool


class TFTChampionResolver:
    """One local, cache-backed resolver for checkpoint/log entity identifiers."""

    # Observed checkpoint alias: this historical key is emitted as a unit id by
    # the client in some matches although current static data also contains an
    # item with the same identifier. Keep that exceptional evidence centralized.
    # Stable checkpoint IDs seen in the tracker fixtures. These resolve even when
    # a fresh installation has not downloaded the optional Data Dragon cache.
    # Unknown IDs remain unresolved rather than being guessed from their suffix.
    _CHAMPION_ALIASES = {
        "DA_SteadfastHeart": ("DA_18_Leona", "Leona"),
        "DA_18_Cassiopeia": ("DA_18_Cassiopeia", "Cassiopeia"),
        "DA_18_Varus": ("DA_18_Varus", "Varus"),
    }

    def __init__(self, assets: TftAssets | None = None) -> None:
        self.assets = (assets or TftAssets()).load_cache()

    def resolve(self, raw_id: str) -> ResolvedEntity:
        value = raw_id.strip()
        alias = self._CHAMPION_ALIASES.get(value)
        if alias:
            return ResolvedEntity(value, alias[0], alias[1], alias[1], True)
        entry = self.assets.entries.get("champion", {}).get(value)
        if entry:
            display = str(entry.get("name") or value)
            return ResolvedEntity(value, value, normalize_champion_id(value), display, True)
        return ResolvedEntity(value, None, None, value, False)

    def resolve_item(self, raw_id: str) -> ResolvedEntity:
        value = raw_id.strip()
        entry = self.assets.entries.get("item", {}).get(value)
        if entry:
            display = str(entry.get("name") or value)
            return ResolvedEntity(value, value, value, display, True)
        return ResolvedEntity(value, None, None, value, False)
