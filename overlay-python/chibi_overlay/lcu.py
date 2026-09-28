"""Backward-compatible import surface for the initial LCU integration.

New code belongs in :mod:`chibi_overlay.riot` so the overlay UI stays endpoint-free.
"""

from chibi_overlay.riot.client import CurrentPlayer, GameSession, LcuClient
from chibi_overlay.riot.connection import LcuUnavailableError

__all__ = ["CurrentPlayer", "GameSession", "LcuClient", "LcuUnavailableError"]
