from __future__ import annotations

import logging
import os
import re
from pathlib import Path

from .events import EventType, TFTEvent
from .normalize import normalize_champion_id
from .values import parse_round

LOGGER = logging.getLogger("chibi.native.tracker")
RAW_ID = re.compile(r"\{([^{}]+)\}")


def parse_log_line(line: str) -> list[TFTEvent]:
    raw_ids = [value for value in RAW_ID.findall(line) if value.strip()]
    raw_id = next((value.strip() for value in raw_ids if value.strip().casefold().startswith(("da_", "tft"))), "")
    events: list[TFTEvent] = []
    if "Audio.Event.VO.Unit.Purchase" in line:
        payload = {"rawId": raw_id, "championId": normalize_champion_id(raw_id)} if raw_id else {}
        events.append(TFTEvent(EventType.UNIT_PURCHASED, "TFT_LOG", payload))
    star_match = re.search(r"Audio\.Event\.VO\.Unit\.StarUp\.([23])Star", line)
    if star_match:
        payload = {"stars": int(star_match.group(1))}
        if raw_id:
            payload.update({"rawId": raw_id, "championId": normalize_champion_id(raw_id)})
        events.append(TFTEvent(EventType.UNIT_STAR_UP, "TFT_LOG", payload))
    if "ItemFlyToBench" in line:
        events.append(TFTEvent(EventType.ITEM_TO_BENCH, "TFT_LOG", {}))
    if "ItemObtain" in line:
        events.append(TFTEvent(EventType.ITEM_OBTAINED, "TFT_LOG", {}))
    if "ViewState.Playing.Shop.Selling" in line:
        events.append(TFTEvent(EventType.SELL_MODE_ACTIVE, "TFT_LOG", {}))
    if "TFTRoundSubsystem" in line or "TFTStagesRoundsTooltipViewModel" in line:
        match = re.search(r"(?<!\d)([1-9]\d?[-:][1-9]\d?)(?!\d)", line)
        if match and (round_value := parse_round(match.group(1).replace(":", "-"))):
            events.append(TFTEvent(EventType.ROUND_UPDATED, "TFT_LOG", {"value": round_value}))
    return events


class TFTLogProvider:
    name = "LogProvider"

    def __init__(self, root: Path | None = None) -> None:
        local = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        self.root = root or local / "TFT"
        self.status = "waiting"
        self.path: Path | None = None
        self.offset = 0
        self.identity: tuple[int, int] | None = None
        self._tail_signature = b""

    def _find_latest(self) -> Path | None:
        try:
            files = [path for path in self.root.rglob("TFT.log") if path.is_file()]
            return max(files, key=lambda item: item.stat().st_mtime) if files else None
        except OSError:
            return None

    def poll(self) -> list[TFTEvent]:
        path = self._find_latest()
        if path is None:
            self.status = "waiting"
            return []
        try:
            stat = path.stat()
            identity = (stat.st_dev, stat.st_ino)
            if self.path is None:
                # Existing logs may contain an entire earlier match. Start at EOF
                # and observe only bytes appended after the tracker began.
                self.path, self.identity, self.offset = path, identity, stat.st_size
                with path.open("rb") as probe:
                    probe.seek(max(0, self.offset - 32))
                    self._tail_signature = probe.read(min(32, self.offset))
                self.status = "connected"
                return []
            reset = self.path != path or self.identity != identity or stat.st_size < self.offset
            if not reset and self.offset:
                with path.open("rb") as probe:
                    probe.seek(max(0, self.offset - 32))
                    reset = probe.read(min(32, self.offset)) != self._tail_signature
            if reset:
                self.path, self.identity, self.offset = path, identity, 0
                self._tail_signature = b""
            with path.open("rb") as source:
                source.seek(self.offset)
                data = source.read()
                self.offset = source.tell()
                source.seek(max(0, self.offset - 32))
                self._tail_signature = source.read(min(32, self.offset))
        except OSError:
            self.status = "error"
            return []
        self.status = "connected"
        events: list[TFTEvent] = []
        for line in data.decode("utf-8", errors="replace").splitlines():
            events.extend(parse_log_line(line))
        if events:
            LOGGER.info("[LogProvider] events=%s", ",".join(event.type.value for event in events))
        return events
