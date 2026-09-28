from __future__ import annotations

import asyncio
import json
import logging
import threading

from websockets.asyncio.server import ServerConnection, serve

from .state import TelemetryState
from .debug_report import OverwolfDebugReport


LOGGER = logging.getLogger("chibi.live_bridge")


class LiveBridgeServer:
    """Loopback-only WebSocket server. It accepts telemetry; it never controls a game."""

    def __init__(self, state: TelemetryState | None = None, host: str = "127.0.0.1", port: int = 8765, report: OverwolfDebugReport | None = None) -> None:
        self.state = state or TelemetryState()
        self.report = report or OverwolfDebugReport()
        self.host, self.port = host, port
        self._thread: threading.Thread | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._stop_event: asyncio.Event | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._run, name="chibi-live-bridge", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        if self._loop and self._stop_event:
            self._loop.call_soon_threadsafe(self._stop_event.set)
        if self._thread:
            self._thread.join(timeout=2)

    def _run(self) -> None:
        asyncio.run(self._serve())

    async def _serve(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._stop_event = asyncio.Event()
        try:
            async with serve(self._handle, self.host, self.port):
                LOGGER.info("[BRIDGE] listening on ws://%s:%s", self.host, self.port)
                await self._stop_event.wait()
        except OSError as error:
            LOGGER.warning("[BRIDGE] unavailable: %s", error)

    async def _handle(self, websocket: ServerConnection) -> None:
        try:
            async for raw in websocket:
                try:
                    message = json.loads(raw)
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({"type": "error", "message": "invalid_json"}))
                    continue
                if not self.state.receive(message):
                    await websocket.send(json.dumps({"type": "error", "message": "invalid_message"}))
                    continue
                self.report.receive(message)
                if message.get("type") == "hello":
                    await websocket.send(json.dumps({"type": "hello_ack", "source": "chibi-python", "version": 1}))
        finally:
            self.state.mark_disconnected()
            self.report.mark_disconnected()
