from __future__ import annotations
from PySide6.QtGui import QAction
from PySide6.QtWidgets import QApplication, QMenu, QStyle, QSystemTrayIcon

def create_tray(window: object, quit_app: callable) -> QSystemTrayIcon | None:
    if not QSystemTrayIcon.isSystemTrayAvailable(): return None
    tray = QSystemTrayIcon(QApplication.style().standardIcon(QStyle.StandardPixmap.SP_ComputerIcon)); menu = QMenu()
    for title, action in (("Abrir Chibi", window.show), ("Mostrar Companion", window.show), ("Ocultar Companion", window.hide), ("Compacto / Expandido", window.toggle_compact), ("Ativar click-through", window.toggle_click_through)):
        item = QAction(title, menu); item.triggered.connect(action); menu.addAction(item)
    positions = menu.addMenu("Posição")
    for title, preset in (("Top Right", "top-right"), ("Top Left", "top-left"), ("Bottom Right", "bottom-right")):
        item = QAction(title, positions); item.triggered.connect(lambda _checked=False, value=preset: window.move_to_preset(value)); positions.addAction(item)
    menu.addSeparator()
    exit_item = QAction("Sair", menu); exit_item.triggered.connect(quit_app); menu.addAction(exit_item)
    tray.setContextMenu(menu); tray.setToolTip("Chibi Native Companion"); tray.show(); return tray
