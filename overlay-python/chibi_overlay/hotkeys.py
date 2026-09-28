from __future__ import annotations

from collections.abc import Callable


class HotkeyManager:
    """Global hotkeys with graceful fallback when keyboard is unavailable."""

    def __init__(self) -> None:
        self._keyboard = None
        self._handles: list[object] = []
        self.available = False

        try:
            import keyboard  # type: ignore
            self._keyboard = keyboard
            self.available = True
        except Exception:
            self._keyboard = None

    def add(self, combo: str, callback: Callable[[], None]) -> bool:
        if not self._keyboard:
            return False
        try:
            handle = self._keyboard.add_hotkey(combo, callback)
            self._handles.append(handle)
            return True
        except Exception:
            return False

    def close(self) -> None:
        if not self._keyboard:
            return
        for handle in self._handles:
            try:
                self._keyboard.remove_hotkey(handle)
            except Exception:
                pass
        self._handles.clear()
