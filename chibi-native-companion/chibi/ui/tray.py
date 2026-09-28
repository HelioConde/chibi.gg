from __future__ import annotations
from PySide6.QtGui import QAction
from PySide6.QtWidgets import QApplication, QMenu, QStyle, QSystemTrayIcon

def create_tray(show: callable, hide: callable, quit_app: callable) -> QSystemTrayIcon | None:
    if not QSystemTrayIcon.isSystemTrayAvailable(): return None
    tray = QSystemTrayIcon(QApplication.style().standardIcon(QStyle.StandardPixmap.SP_ComputerIcon)); menu = QMenu()
    for title, action in (("Abrir Chibi", show), ("Mostrar Companion", show), ("Ocultar Companion", hide), ("Sair", quit_app)):
        item = QAction(title, menu); item.triggered.connect(action); menu.addAction(item)
    tray.setContextMenu(menu); tray.setToolTip("Chibi Native Companion"); tray.show(); return tray
