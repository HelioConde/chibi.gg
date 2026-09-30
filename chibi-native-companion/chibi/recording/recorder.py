from __future__ import annotations

import gzip
import json
import shutil
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path
from time import time
from typing import Any

from chibi.core.settings import app_data_dir
from chibi.tracker.events import TFTEvent

SCHEMA_VERSION = 1


def _normalize_game_id(value: object, region: object = "") -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    if "_" in raw:
        return raw
    prefix = str(region or "").strip().upper()
    if prefix and raw.isdigit():
        return prefix + "_" + raw
    return raw


def _safe(value: object) -> object:
    """Drop adversary-shaped/raw checkpoint payloads before persistence."""
    if isinstance(value, dict):
        return {str(key): _safe(item) for key, item in value.items() if key not in {"players", "participants", "opponents"}}
    if isinstance(value, list): return [_safe(item) for item in value]
    return value


@dataclass(frozen=True, slots=True)
class RecorderStatus:
    state: str = "idle"
    session_id: str | None = None
    events: int = 0
    snapshots: int = 0
    upload: str = "waiting_for_game"
    riot_match: str = "not_requested"


class MatchSessionRecorder:
    """Append-only own-player event/snapshot recorder with crash-safe finalization."""
    def __init__(self, root: Path | None = None, snapshot_interval: float = 8.0) -> None:
        self.root = root or app_data_dir() / "sessions"
        for name in ("active", "pending", "uploaded", "finalized", "recovered"):
            (self.root / name).mkdir(parents=True, exist_ok=True)
        self.snapshot_interval = snapshot_interval
        self.status = RecorderStatus()
        self._path: Path | None = None
        self._owner = ""
        self._last_snapshot = 0.0
        self._started = 0.0

    def start(self, snapshot: object, fallback: object | None = None) -> None:
        if self.status.state == "recording": return
        fallback_player = getattr(fallback, "player", None)
        self._owner = str(
            getattr(snapshot, "player_puuid", "")
            or getattr(getattr(snapshot, "player", None), "puuid", "")
            or getattr(fallback_player, "puuid", "")
            or ""
        )
        session_id = uuid.uuid4().hex
        self._started = time(); self._last_snapshot = 0.0
        self._path = self.root / "active" / f"{session_id}.jsonl"; self._path.parent.mkdir(parents=True, exist_ok=True)
        self.status = RecorderStatus("recording", session_id, upload="locked_until_game_end")
        details = getattr(snapshot, "details", {}) if isinstance(getattr(snapshot, "details", {}), dict) else {}
        fallback_details = getattr(fallback, "details", {}) if fallback is not None and isinstance(getattr(fallback, "details", {}), dict) else {}
        region = str(details.get("platform") or fallback_details.get("platform") or "")
        raw_game_id = (
            details.get("game_id")
            or details.get("gameId")
            or getattr(snapshot, "game_id", None)
            or getattr(fallback, "game_id", None)
        )
        game_id = _normalize_game_id(raw_game_id, region)
        queue_id = getattr(snapshot, "queue_id", None) or getattr(fallback, "queue_id", None)
        queue_name = getattr(snapshot, "queue_name", "") or getattr(fallback, "queue_name", "")
        self._append({"kind":"session", "schemaVersion":SCHEMA_VERSION, "sessionId":session_id, "ownerPuuid":self._owner,
                      "gameId":game_id, "startedAt":self._started, "queueId":queue_id,
                      "queueName":queue_name, "region":region})
        self._append({"kind":"event", "eventId":uuid.uuid4().hex, "type":"GAME_STARTED", "observedAt":self._started})

    def event(self, event: TFTEvent, state: object) -> None:
        if self.status.state != "recording": return
        self._append({"kind":"event", "schemaVersion":SCHEMA_VERSION, "eventId":uuid.uuid4().hex, "sessionId":self.status.session_id,
                      "gameId":getattr(state,"game_id",None), "observedAt":event.timestamp, "gameTime":max(0.0,event.timestamp-self._started),
                      "round":getattr(getattr(state,"round",None),"value",None), "type":event.type.value,
                      "payload":_safe(event.payload), "source":event.source, "confidence":event.confidence})
        self.status = RecorderStatus("recording", self.status.session_id, self.status.events+1, self.status.snapshots, "locked_until_game_end")

    def snapshot(self, state: object, force: bool = False) -> None:
        if self.status.state != "recording": return
        now=time()
        if not force and now-self._last_snapshot < self.snapshot_interval: return
        player=getattr(state,"player",None); board=getattr(state,"board",[])
        self._append({"kind":"snapshot", "schemaVersion":SCHEMA_VERSION, "sessionId":self.status.session_id, "gameId":getattr(state,"game_id",None),
                      "observedAt":now, "gameTime":max(0.0,now-self._started), "round":getattr(getattr(state,"round",None),"value",None),
                      "hp":getattr(getattr(player,"hp",None),"value",None), "gold":getattr(getattr(player,"gold",None),"value",None),
                      "level":getattr(getattr(player,"level",None),"value",None), "board":[asdict(piece) for piece in board],
                      "augments":list(getattr(state,"augments",[])), "sources":{"hp":getattr(getattr(player,"hp",None),"source",None),"gold":getattr(getattr(player,"gold",None),"source",None),"level":getattr(getattr(player,"level",None),"source",None)}})
        self._last_snapshot=now; self.status=RecorderStatus("recording",self.status.session_id,self.status.events,self.status.snapshots+1,"locked_until_game_end")

    def finalize(self, state: object, incomplete: bool = False) -> Path | None:
        if self.status.state != "recording" or self._path is None: return None
        self.snapshot(state, force=True); ended=time()
        self._append({"kind":"event","eventId":uuid.uuid4().hex,"type":"GAME_ENDED","observedAt":ended,"incomplete":incomplete})
        rows=[json.loads(line) for line in self._path.read_text(encoding="utf-8").splitlines() if line]
        session=dict(rows[0])
        if not session.get("gameId"):
            observed_game_id=next((row.get("gameId") for row in reversed(rows) if row.get("gameId")),None)
            session["gameId"]=_normalize_game_id(observed_game_id,session.get("region"))
        package={"schemaVersion":SCHEMA_VERSION,"session":session,"telemetry":{"events":[row for row in rows if row.get("kind")=="event"],"snapshots":[row for row in rows if row.get("kind")=="snapshot"]},"quality":self._quality(rows),"riotMatch":None}
        target=self.root/"pending"/f"{self.status.session_id}.json.gz"; target.parent.mkdir(parents=True,exist_ok=True)
        with gzip.open(target,"wt",encoding="utf-8") as output: json.dump(package,output,separators=(",",":"))
        archived=self.root/("recovered" if incomplete else "finalized")/self._path.name; archived.parent.mkdir(parents=True,exist_ok=True); shutil.move(str(self._path),archived)
        self.status=RecorderStatus("recovered_incomplete" if incomplete else "finalized",self.status.session_id,self.status.events,self.status.snapshots,"pending","waiting")
        return target

    def set_upload_status(self, upload: str) -> None:
        self.status = RecorderStatus(
            self.status.state,
            self.status.session_id,
            self.status.events,
            self.status.snapshots,
            upload,
            self.status.riot_match,
        )

    def recover(self, game_running: bool, current_game_id: str | None = None) -> list[Path]:
        recovered=[]
        for path in (self.root/"active").glob("*.jsonl") if (self.root/"active").exists() else []:
            if game_running: continue
            target=self.root/"recovered"/path.name; target.parent.mkdir(parents=True,exist_ok=True); shutil.move(str(path),target); recovered.append(target)
        return recovered

    def _append(self, value: dict[str, Any]) -> None:
        assert self._path is not None
        with self._path.open("a",encoding="utf-8") as output: output.write(json.dumps(value,separators=(",",":"))+"\n")

    def _quality(self, rows: list[dict[str,object]]) -> dict[str,object]:
        snapshots=[row for row in rows if row.get("kind")=="snapshot"]; events=[row for row in rows if row.get("kind")=="event"]
        total=max(1,len(snapshots)); gold=sum(1 for row in snapshots if row.get("gold") is not None)
        level=sum(1 for row in snapshots if row.get("level") is not None); round_count=sum(1 for row in snapshots if row.get("round") is not None)
        coverage=(gold+level+round_count)/(total*3)
        return {"telemetryCoverage":round(coverage,2),"visionGoldCoverage":round(gold/total,2),"visionLevelCoverage":round(level/total,2),"roundCoverage":round(round_count/total,2),"checkpointCount":len(snapshots),"eventCount":len(events),"flag":"COMPLETE" if coverage>=.8 else "PARTIAL" if coverage>=.4 else "LOW_CONFIDENCE"}
