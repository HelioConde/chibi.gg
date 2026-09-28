from __future__ import annotations
from dataclasses import asdict, dataclass
from typing import Iterable
import psutil
from .process import RiotProcess

@dataclass(frozen=True, slots=True)
class LocalService:
    pid: int; process: str; protocol: str; local_address: str; local_port: int; state: str
    def to_dict(self) -> dict[str, object]: return asdict(self)

def localhost_services(processes: Iterable[RiotProcess], connections: Iterable[object] | None = None) -> list[LocalService]:
    names = {process.pid: process.name for process in processes}; source = connections if connections is not None else psutil.net_connections(kind="tcp")
    services: list[LocalService] = []
    for connection in source:
        try:
            pid, address = getattr(connection, "pid", None), getattr(connection, "laddr", None)
            host = getattr(address, "ip", None) or (address[0] if isinstance(address, tuple) and address else "")
            port = getattr(address, "port", None) or (address[1] if isinstance(address, tuple) and len(address) > 1 else None)
            if pid in names and host in {"127.0.0.1", "::1"} and isinstance(port, int): services.append(LocalService(pid, names[pid], "tcp", str(host), port, str(getattr(connection, "status", ""))))
        except (psutil.Error, IndexError, TypeError): continue
    return sorted(services, key=lambda service: (service.pid, service.local_port))
