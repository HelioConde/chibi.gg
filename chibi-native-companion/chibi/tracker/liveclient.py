from __future__ import annotations

import json
import ssl
from urllib.error import URLError
from urllib.request import urlopen

from .events import TFTEvent


class TFTLiveClientProvider:
    """Best-effort optional provider. The tracker never relies on it."""
    name = "LiveClientData"

    def __init__(self) -> None:
        self.status = "unavailable"

    def poll(self) -> list[TFTEvent]:
        try:
            context = ssl._create_unverified_context()
            with urlopen("https://127.0.0.1:2999/liveclientdata/activeplayer", timeout=0.35, context=context) as response:
                data = json.load(response)
            self.status = "connected" if isinstance(data, dict) else "unavailable"
        except (OSError, URLError, ValueError):
            self.status = "unavailable"
        return []
