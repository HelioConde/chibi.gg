from __future__ import annotations

import gzip
import json
from pathlib import Path
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from chibi.api.client import DEFAULT_BASE

class PostGameUploadQueue:
    """Retries finalized gzip packages only; it has no gameplay upload path."""
    def __init__(self, root: Path, token_provider: object | None = None, base_url: str = DEFAULT_BASE) -> None:
        self.root,self.token_provider,self.base_url=root,token_provider,base_url.rstrip("/"); self.status="waiting_for_game_end"; self._next=0.0; self._backoff=5.0
    def poll(self) -> None:
        if monotonic()<self._next:return
        token=self.token_provider() if callable(self.token_provider) else None
        if not token: self.status="auth_required"; return
        packages=sorted((self.root/"pending").glob("*.json.gz")) if (self.root/"pending").exists() else []
        if not packages: self.status="idle"; return
        package=packages[0]
        try:
            data=package.read_bytes(); request=Request(self.base_url+"/telemetry-matches",data=data,method="POST",headers={"Content-Type":"application/gzip","Content-Encoding":"gzip","Authorization":"Bearer "+str(token),"User-Agent":"ChibiNativeCompanion/0.1"})
            with urlopen(request,timeout=15) as response: body=json.load(response)
            if not isinstance(body,dict) or not body.get("ack"): raise ValueError("invalid_ack")
            target=self.root/"uploaded"/package.name; target.parent.mkdir(parents=True,exist_ok=True); package.replace(target); self.status="uploaded"; self._backoff=5.0
        except (HTTPError,URLError,OSError,ValueError): self.status="retry_wait"; self._next=monotonic()+self._backoff; self._backoff=min(300.0,self._backoff*2)
