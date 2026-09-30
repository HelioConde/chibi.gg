from __future__ import annotations
from typing import Any

def reconcile(package: dict[str, Any], official: dict[str, Any], owner_puuid: str) -> dict[str, Any]:
    """Riot Match overwrites final result only; local timeline stays untouched."""
    participants=official.get("participants") if isinstance(official.get("participants"),list) else []
    me=next((row for row in participants if isinstance(row,dict) and row.get("puuid")==owner_puuid),None)
    result=dict(package); result["riotMatch"]={"source":"RIOT_MATCH","participant":me,"match":{key:official.get(key) for key in ("id","duration","queueId","setNumber","setName","gameVersion")}}
    result["reconciliation"]={"status":"reconciled" if me else "owner_not_found"}
    return result
