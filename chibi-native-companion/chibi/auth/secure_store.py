from __future__ import annotations

import base64
import ctypes
import json
from ctypes import wintypes
from dataclasses import dataclass, asdict
from pathlib import Path

from chibi.core.settings import app_data_dir

class _Blob(ctypes.Structure):
    _fields_=[("cbData",wintypes.DWORD),("pbData",ctypes.POINTER(ctypes.c_byte))]

@dataclass(frozen=True, slots=True)
class AuthSession:
    access_token:str
    refresh_token:str
    expires_at:float
    user_id:str=""

class SecureTokenStore:
    """Windows DPAPI, scoped to this Windows user; no plaintext token file."""
    def __init__(self,path:Path|None=None)->None: self.path=path or app_data_dir()/"secure"/"chibi-session.dpapi"
    def save_session(self,session:AuthSession)->None:
        raw=json.dumps(asdict(session),separators=(",",":")).encode(); protected=self._protect(raw)
        self.path.parent.mkdir(parents=True,exist_ok=True); self.path.write_bytes(protected)
    def load_session(self)->AuthSession|None:
        try:
            data=json.loads(self._unprotect(self.path.read_bytes()).decode())
            return AuthSession(str(data["access_token"]),str(data["refresh_token"]),float(data["expires_at"]),str(data.get("user_id") or ""))
        except (OSError,ValueError,KeyError,ctypes.ArgumentError): return None
    def clear_session(self)->None:
        try:self.path.unlink()
        except FileNotFoundError:pass
    @staticmethod
    def _protect(raw:bytes)->bytes:
        if not hasattr(ctypes,"windll"): raise RuntimeError("dpapi_unavailable")
        source=ctypes.create_string_buffer(raw); source_blob=_Blob(len(raw),ctypes.cast(source,ctypes.POINTER(ctypes.c_byte))); target=_Blob()
        if not ctypes.windll.crypt32.CryptProtectData(ctypes.byref(source_blob),"Chibi Companion",None,None,None,0,ctypes.byref(target)): raise ctypes.WinError()
        try:return ctypes.string_at(target.pbData,target.cbData)
        finally:ctypes.windll.kernel32.LocalFree(target.pbData)
    @staticmethod
    def _unprotect(raw:bytes)->bytes:
        source=ctypes.create_string_buffer(raw); source_blob=_Blob(len(raw),ctypes.cast(source,ctypes.POINTER(ctypes.c_byte))); target=_Blob()
        if not ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(source_blob),None,None,None,None,0,ctypes.byref(target)): raise ctypes.WinError()
        try:return ctypes.string_at(target.pbData,target.cbData)
        finally:ctypes.windll.kernel32.LocalFree(target.pbData)
