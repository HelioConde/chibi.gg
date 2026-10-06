from __future__ import annotations

import json
from time import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from chibi.auth.secure_store import AuthSession, SecureTokenStore

SUPABASE_URL = "https://bieihhaobdztjyoweewa.supabase.co"
SUPABASE_PUBLISHABLE_KEY = "sb_publishable_2T2H_S0Lu3qlM42kDUWI9g_3FtYXjUt"


class ChibiAuthError(RuntimeError):
    def __init__(self, code: str, message: str = "") -> None:
        super().__init__(message or code)
        self.code = code


class ChibiAuthClient:
    """Supabase Auth client. The publishable key is public; passwords are never persisted."""

    def __init__(self, timeout: float = 10.0) -> None:
        self.timeout = timeout

    def login(self, email: str, password: str) -> AuthSession:
        body = {"email": email.strip(), "password": password}
        data = self._post("/auth/v1/token?grant_type=password", body)
        return self._session(data)

    def refresh(self, refresh_token: str) -> AuthSession:
        data = self._post("/auth/v1/token?grant_type=refresh_token", {"refresh_token": refresh_token})
        return self._session(data)

    def account_link(self, access_token: str) -> dict[str, object] | None:
        request = Request(
            SUPABASE_URL + "/rest/v1/chibi_riot_account_links?select=region,game_name,tag_line,verified_at&limit=1",
            method="GET",
            headers={
                "apikey": SUPABASE_PUBLISHABLE_KEY,
                "Authorization": "Bearer " + access_token,
                "User-Agent": "ChibiNativeCompanion/0.1",
            },
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                data = json.load(response)
        except Exception:
            return None
        if not isinstance(data, list) or not data:
            return None
        row = data[0]
        return row if isinstance(row, dict) else None

    def logout(self, access_token: str) -> None:
        request = Request(
            SUPABASE_URL + "/auth/v1/logout?scope=global",
            data=b"{}",
            method="POST",
            headers={
                "apikey": SUPABASE_PUBLISHABLE_KEY,
                "Authorization": "Bearer " + access_token,
                "Content-Type": "application/json",
                "User-Agent": "ChibiNativeCompanion/0.1",
            },
        )
        try:
            with urlopen(request, timeout=self.timeout):
                return
        except Exception:
            return

    def _post(self, path: str, body: dict[str, object]) -> dict[str, object]:
        request = Request(
            SUPABASE_URL + path,
            data=json.dumps(body).encode("utf-8"),
            method="POST",
            headers={
                "apikey": SUPABASE_PUBLISHABLE_KEY,
                "Content-Type": "application/json",
                "User-Agent": "ChibiNativeCompanion/0.1",
            },
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                data = json.load(response)
        except HTTPError as error:
            try:
                data = json.load(error)
            except Exception:
                data = {}
            raise ChibiAuthError(
                str(data.get("error_code") or data.get("error") or "auth_failed"),
                str(data.get("msg") or data.get("message") or "Não foi possível autenticar."),
            ) from error
        except (URLError, OSError, ValueError) as error:
            raise ChibiAuthError("network_error", "Não foi possível conectar ao Chibi.") from error
        if not isinstance(data, dict):
            raise ChibiAuthError("invalid_response")
        return data

    @staticmethod
    def _session(data: dict[str, object]) -> AuthSession:
        access_token = str(data.get("access_token") or "")
        refresh_token = str(data.get("refresh_token") or "")
        user = data.get("user") if isinstance(data.get("user"), dict) else {}
        user_id = str(user.get("id") or "") if isinstance(user, dict) else ""
        expires_at_raw = data.get("expires_at")
        try:
            expires_at = float(expires_at_raw) if expires_at_raw is not None else time() + float(data.get("expires_in") or 3600)
        except (TypeError, ValueError):
            expires_at = time() + 3600
        if not access_token or not refresh_token:
            raise ChibiAuthError("missing_session")
        return AuthSession(access_token, refresh_token, expires_at, user_id)


class SessionProvider:
    """Callable access-token provider with transparent refresh and DPAPI persistence."""

    def __init__(
        self,
        store: SecureTokenStore,
        client: ChibiAuthClient | None = None,
        refresh_margin: float = 90.0,
    ) -> None:
        self.store = store
        self.client = client or ChibiAuthClient()
        self.refresh_margin = refresh_margin

    def __call__(self) -> str | None:
        session = self.store.load_session()
        if session is None:
            return None
        if session.expires_at > time() + self.refresh_margin:
            return session.access_token
        try:
            refreshed = self.client.refresh(session.refresh_token)
        except ChibiAuthError as error:
            if error.code not in {"network_error"}:
                self.store.clear_session()
            return None
        self.store.save_session(refreshed)
        return refreshed.access_token

    def invalidate(self) -> None:
        self.store.clear_session()
