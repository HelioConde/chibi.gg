"""Local-only bridge smoke test. It never contacts Riot or the game client."""

from __future__ import annotations

import asyncio
import json
import time

from websockets.asyncio.client import connect


async def main() -> None:
    async with connect("ws://127.0.0.1:8765") as socket:
        await socket.send(json.dumps({"type": "hello", "version": 1, "timestamp": int(time.time() * 1000)}))
        print(await socket.recv())
        await socket.send(json.dumps({
            "type": "tft_live_snapshot", "version": 1, "timestamp": int(time.time() * 1000),
            "data": {"gameRunning": True, "match_info": {"stage": "3-2"}, "me": {"health": 78, "gold": 42, "level": 6}, "board": [{"id": "demo-unit", "name": "Demo Unit"}]},
        }))


if __name__ == "__main__":
    asyncio.run(main())
