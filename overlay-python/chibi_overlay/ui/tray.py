from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

from PySide6.QtCore import QUrl
from PySide6.QtGui import QAction, QDesktopServices
from PySide6.QtWidgets import QApplication, QMenu, QStyle, QSystemTrayIcon


class TrayController:
    def __init__(
        self,
        *,
        show_overlay: Callable[[], None],
        hide_overlay: Callable[[], None],
        toggle_compact: Callable[[], None],
        set_session_mode: Callable[[], None],
        toggle_clickthrough: Callable[[], None],
        data_dir: Path,
        quit_app: Callable[[], None],
    ) -> None:
        self.tray: QSystemTrayIcon | None = None
        if not QSystemTrayIcon.isSystemTrayAvailable():
            return
        icon = QApplication.style().standardIcon(QStyle.StandardPixmap.SP_ComputerIcon)
        tray = QSystemTrayIcon(icon)
        tray.setToolTip("Chibi Companion")
        menu = QMenu()
        self._action(menu, "Abrir Chibi", show_overlay)
        self._action(menu, "Mostrar Overlay", show_overlay)
        self._action(menu, "Ocultar Overlay", hide_overlay)
        self._action(menu, "Modo compacto", toggle_compact)
        self._action(menu, "Modo sessão", set_session_mode)
        self._action(menu, "Ativar Click-through", toggle_clickthrough)
        self._action(menu, "Abrir pasta de dados", lambda: QDesktopServices.openUrl(QUrl.fromLocalFile(str(data_dir))))
        menu.addSeparator()
        self._action(menu, "Sair", quit_app)
        tray.setContextMenu(menu)
        tray.activated.connect(lambda reason: show_overlay() if reason == QSystemTrayIcon.ActivationReason.Trigger else None)
        tray.show()
        self.tray = tray

    @staticmethod
    def _action(menu: QMenu, title: str, callback: Callable[[], None]) -> None:
        action = QAction(title, menu)
        action.triggered.connect(callback)
        menu.addAction(action)
