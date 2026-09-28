from __future__ import annotations

import ctypes
import os
from pathlib import Path

from PySide6.QtCore import QObject, QPoint, Qt, QTimer, Signal
from PySide6.QtGui import QCloseEvent, QMouseEvent
from PySide6.QtWidgets import (
    QApplication,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QPushButton,
    QSlider,
    QVBoxLayout,
    QWidget,
)

from .hotkeys import HotkeyManager
from .models import OverlaySnapshot, fields_for_overlay
from .riot.gameflow import DemoGameflowMonitor, GameflowMonitor
from .riot.models import FieldSource, GameState, GameStateSnapshot
from .storage import LocalStore
from .ui.status_card import GameStatusCard
from .ui.tray import TrayController


class HotkeySignals(QObject):
    toggle_visibility = Signal()
    toggle_compact = Signal()
    toggle_clickthrough = Signal()
    opacity_up = Signal()
    opacity_down = Signal()
    advance_demo = Signal()


class OverlayWindow(QMainWindow):
    EXPANDED_SIZE = (540, 610)
    COMPACT_SIZE = (430, 245)

    def __init__(self, store: LocalStore, *, demo: bool = False) -> None:
        super().__init__()
        self.store = store
        self.riot_state = GameStateSnapshot(state=GameState.CLIENT_OFFLINE)
        self.monitor = DemoGameflowMonitor(self) if demo else GameflowMonitor(parent=self)
        self.demo = demo
        self._quitting = False
        self.settings = store.load_settings()
        self.snapshot = OverlaySnapshot()
        self.compact = bool(self.settings.get("compact", False))
        self.locked = bool(self.settings.get("locked", False))
        self.clickthrough = bool(self.settings.get("clickthrough", False))
        self.drag_origin: QPoint | None = None
        self.drag_window_origin: QPoint | None = None

        self.setWindowTitle("Chibi Companion")
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.Tool
        )

        opacity = float(self.settings.get("opacity", 0.94))
        self.setWindowOpacity(max(0.55, min(1.0, opacity)))

        self._build_ui()
        self._restore_position()
        self._apply_mode()
        self._setup_hotkeys()
        self._setup_snapshot_watch()
        self.refresh_snapshot(force=True)
        self.tray = TrayController(
            show_overlay=self.show_overlay,
            toggle_visibility=self.toggle_visibility,
            toggle_compact=self.toggle_compact,
            toggle_clickthrough=self.toggle_clickthrough,
            data_dir=self.store.settings_path.parent,
            quit_app=self.request_exit,
        )
        self.monitor.state_changed.connect(self._on_riot_state)
        self.monitor.start()
        if self.clickthrough:
            QTimer.singleShot(0, lambda: self._set_windows_clickthrough(True))

    def _build_ui(self) -> None:
        root = QWidget()
        root_layout = QVBoxLayout(root)
        root_layout.setContentsMargins(8, 8, 8, 8)

        self.card = QFrame()
        self.card.setObjectName("overlayRoot")
        root_layout.addWidget(self.card)

        layout = QVBoxLayout(self.card)
        layout.setContentsMargins(14, 12, 14, 12)
        layout.setSpacing(9)

        header = QHBoxLayout()
        brand = QLabel("C")
        brand.setObjectName("brandIcon")
        header.addWidget(brand)

        title_wrap = QVBoxLayout()
        title_wrap.setSpacing(0)
        title = QLabel("CHIBI COMPANION")
        title.setObjectName("brandTitle")
        self.player_label = QLabel("snapshot local")
        self.player_label.setObjectName("muted")
        title_wrap.addWidget(title)
        title_wrap.addWidget(self.player_label)
        header.addLayout(title_wrap)
        header.addStretch(1)

        self.connection_badge = QLabel("RIOT OFFLINE")
        self.connection_badge.setObjectName("statusBadge")
        header.addWidget(self.connection_badge)

        self.compact_button = QPushButton("↕")
        self.compact_button.setToolTip("Compactar / expandir (Ctrl+Shift+C)")
        self.compact_button.clicked.connect(self.toggle_compact)
        header.addWidget(self.compact_button)

        self.lock_button = QPushButton("⌖")
        self.lock_button.setToolTip("Travar / liberar posição")
        self.lock_button.clicked.connect(self.toggle_lock)
        header.addWidget(self.lock_button)

        self.click_button = QPushButton("◌")
        self.click_button.setToolTip("Click-through (Ctrl+Shift+L)")
        self.click_button.clicked.connect(self.toggle_clickthrough)
        header.addWidget(self.click_button)

        layout.addLayout(header)

        self.rank_label = QLabel("Perfil ainda não conectado")
        self.rank_label.setObjectName("rankLabel")
        layout.addWidget(self.rank_label)

        self.live_label = QLabel("Aguardando League Client")
        self.live_label.setObjectName("liveLabel")
        layout.addWidget(self.live_label)

        self.status_card = GameStatusCard()
        layout.addWidget(self.status_card)

        self.stats_wrap = QWidget()
        stats = QGridLayout(self.stats_wrap)
        stats.setHorizontalSpacing(6)
        stats.setVerticalSpacing(6)
        self.stat_labels: dict[str, QLabel] = {}
        for index, (key, caption) in enumerate(
            [
                ("stage", "STAGE"),
                ("hp", "HP"),
                ("gold", "GOLD"),
                ("level", "LVL"),
                ("streak", "STREAK"),
            ]
        ):
            box = QFrame()
            box.setObjectName("statBox")
            box_layout = QVBoxLayout(box)
            box_layout.setContentsMargins(8, 6, 8, 6)
            box_layout.setSpacing(2)
            cap = QLabel(caption)
            cap.setObjectName("statCaption")
            value = QLabel("—")
            value.setObjectName("statValue")
            box_layout.addWidget(cap)
            box_layout.addWidget(value)
            stats.addWidget(box, 0, index)
            self.stat_labels[key] = value
        layout.addWidget(self.stats_wrap)

        self.focus_card = QFrame()
        self.focus_card.setObjectName("focusCard")
        focus_layout = QVBoxLayout(self.focus_card)
        focus_layout.setContentsMargins(11, 9, 11, 9)
        focus_layout.setSpacing(4)
        focus_caption = QLabel("FOCO FIXADO")
        focus_caption.setObjectName("sectionCaption")
        self.focus_title = QLabel("Revise uma decisão por vez")
        self.focus_title.setObjectName("focusTitle")
        self.focus_title.setWordWrap(True)
        self.avoid_label = QLabel("")
        self.avoid_label.setObjectName("muted")
        self.avoid_label.setWordWrap(True)
        focus_layout.addWidget(focus_caption)
        focus_layout.addWidget(self.focus_title)
        focus_layout.addWidget(self.avoid_label)
        layout.addWidget(self.focus_card)

        self.detail_wrap = QWidget()
        detail_layout = QVBoxLayout(self.detail_wrap)
        detail_layout.setContentsMargins(0, 0, 0, 0)
        detail_layout.setSpacing(8)

        self.board_card = QFrame()
        self.board_card.setObjectName("panelCard")
        board_layout = QVBoxLayout(self.board_card)
        board_layout.setContentsMargins(10, 9, 10, 9)
        board_layout.setSpacing(6)

        board_title = QHBoxLayout()
        self.board_caption = self._caption("BOARD SNAPSHOT")
        board_title.addWidget(self.board_caption)
        board_title.addStretch(1)
        self.score_label = QLabel("—")
        self.score_label.setObjectName("score")
        board_title.addWidget(self.score_label)
        board_layout.addLayout(board_title)

        self.board_unavailable_label = QLabel("Board ao vivo ainda não disponível")
        self.board_unavailable_label.setObjectName("muted")
        self.board_unavailable_label.setVisible(False)
        board_layout.addWidget(self.board_unavailable_label)

        self.board_grid_wrap = QWidget()
        self.board_grid = QGridLayout(self.board_grid_wrap)
        self.board_grid.setHorizontalSpacing(3)
        self.board_grid.setVerticalSpacing(3)
        self.board_cells: list[QLabel] = []
        for slot in range(28):
            cell = QLabel("")
            cell.setAlignment(Qt.AlignmentFlag.AlignCenter)
            cell.setProperty("occupied", False)
            cell.setProperty("role", "")
            cell.setObjectName("hexCell")
            self.board_grid.addWidget(cell, slot // 7, slot % 7)
            self.board_cells.append(cell)
        board_layout.addWidget(self.board_grid_wrap)
        detail_layout.addWidget(self.board_card)

        review_card = QFrame()
        review_card.setObjectName("panelCard")
        review_layout = QVBoxLayout(review_card)
        review_layout.setContentsMargins(10, 9, 10, 9)
        review_layout.setSpacing(5)
        review_layout.addWidget(self._caption("PERGUNTAS PARA REVER"))
        self.review_labels: list[QLabel] = []
        for index in range(3):
            label = QLabel(f"{index + 1}. —")
            label.setObjectName("reviewQuestion")
            label.setWordWrap(True)
            review_layout.addWidget(label)
            self.review_labels.append(label)
        detail_layout.addWidget(review_card)

        layout.addWidget(self.detail_wrap)

        footer = QHBoxLayout()
        self.snapshot_path_label = QLabel(f"snapshot: {Path(self.store.snapshot_path).name}")
        self.snapshot_path_label.setObjectName("footerText")
        footer.addWidget(self.snapshot_path_label)
        footer.addStretch(1)

        minus = QPushButton("−")
        minus.setToolTip("Diminuir opacidade (Ctrl+Shift+Down)")
        minus.clicked.connect(lambda: self.adjust_opacity(-0.05))
        footer.addWidget(minus)

        self.opacity_slider = QSlider(Qt.Orientation.Horizontal)
        self.opacity_slider.setRange(55, 100)
        self.opacity_slider.setFixedWidth(82)
        self.opacity_slider.setValue(round(self.windowOpacity() * 100))
        self.opacity_slider.valueChanged.connect(
            lambda value: self.set_overlay_opacity(value / 100)
        )
        footer.addWidget(self.opacity_slider)

        plus = QPushButton("+")
        plus.setToolTip("Aumentar opacidade (Ctrl+Shift+Up)")
        plus.clicked.connect(lambda: self.adjust_opacity(0.05))
        footer.addWidget(plus)
        layout.addLayout(footer)

        self.setCentralWidget(root)
        self.setStyleSheet(self._stylesheet())

    def _caption(self, text: str) -> QLabel:
        label = QLabel(text)
        label.setObjectName("sectionCaption")
        return label

    def _stylesheet(self) -> str:
        return """
        QWidget {
            color: #e9edf6;
            font-family: "Segoe UI", "Inter", sans-serif;
            font-size: 11px;
        }
        #overlayRoot {
            border: 1px solid rgba(115, 98, 190, 150);
            border-radius: 16px;
            background-color: rgba(9, 14, 23, 244);
        }
        QPushButton {
            min-width: 26px;
            min-height: 24px;
            border: 1px solid #303a50;
            border-radius: 7px;
            background: #111925;
            color: #99a6ba;
            font-weight: 800;
        }
        QPushButton:hover {
            border-color: #6758bf;
            color: #ded8ff;
            background: #151d2b;
        }
        #brandIcon {
            min-width: 30px;
            min-height: 30px;
            max-width: 30px;
            max-height: 30px;
            border: 1px solid #6f5bd0;
            border-radius: 9px;
            background: #6f50e7;
            color: white;
            font-weight: 950;
            qproperty-alignment: AlignCenter;
        }
        #brandTitle {
            color: #ffffff;
            font-size: 12px;
            font-weight: 950;
        }
        #muted, #footerText {
            color: #657288;
            font-size: 9px;
        }
        #rankLabel {
            color: #9ca8ba;
            font-size: 10px;
        }
        #liveLabel {
            color: #72819a;
            font-size: 8px;
            font-weight: 850;
        }
        #statusBadge {
            padding: 5px 8px;
            border: 1px solid rgba(78, 171, 126, 110);
            border-radius: 8px;
            color: #7fd0a4;
            background: rgba(42, 120, 78, 30);
            font-size: 8px;
            font-weight: 950;
        }
        #gameStatusCard {
            border: 1px solid #303a50;
            border-radius: 10px;
            background: #0e1621;
        }
        #gameStatusCard[tone="queue"] { border-color: #6f5bd0; background: #15142a; }
        #gameStatusCard[tone="alert"] { border-color: #d59a3f; background: #2b2113; }
        #gameStatusCard[tone="success"] { border-color: #4eab7e; background: #10241d; }
        #gameStatusCard[tone="danger"] { border-color: #bb5e67; background: #29171b; }
        #gameStatusIcon {
            min-width: 27px; min-height: 27px; border-radius: 8px;
            color: #d9d2ff; background: #25203f; font-size: 15px; font-weight: 900;
        }
        #gameStatusTitle { color: #f5f7ff; font-size: 11px; font-weight: 950; }
        #gameStatusDescription { color: #9da9bb; font-size: 9px; }
        #gameStatusIndicator { color: #7fd0a4; font-size: 11px; }
        #statBox, #panelCard {
            border: 1px solid #263044;
            border-radius: 9px;
            background: #0e1621;
        }
        #statCaption, #sectionCaption {
            color: #6c7990;
            font-size: 8px;
            font-weight: 950;
        }
        #statValue {
            color: #eef2f8;
            font-size: 15px;
            font-weight: 950;
        }
        #focusCard {
            border: 1px solid rgba(111, 82, 212, 105);
            border-radius: 10px;
            background: rgba(88, 62, 181, 24);
        }
        #focusTitle {
            color: #ffffff;
            font-size: 13px;
            font-weight: 900;
        }
        #score {
            color: #a995ff;
            font-size: 12px;
            font-weight: 950;
        }
        #hexCell {
            min-width: 42px;
            min-height: 30px;
            border: 1px solid #27344a;
            border-radius: 7px;
            background: #101925;
            color: #6f7c91;
            font-size: 9px;
            font-weight: 950;
        }
        #hexCell[occupied="true"] {
            border-color: #6757c4;
            background: #1a1d33;
            color: #f0edff;
        }
        #hexCell[role="tank"] {
            border-color: #4b91b7;
        }
        #hexCell[role="carry"] {
            border-color: #c88451;
        }
        #hexCell[role="utility"] {
            border-color: #8070c6;
        }
        #reviewQuestion {
            padding: 6px 8px;
            border-radius: 7px;
            background: #111a25;
            color: #aeb8c8;
            font-size: 10px;
        }
        QSlider::groove:horizontal {
            height: 4px;
            border-radius: 2px;
            background: #263044;
        }
        QSlider::handle:horizontal {
            width: 10px;
            margin: -4px 0;
            border-radius: 5px;
            background: #8269f5;
        }
        """

    def _setup_snapshot_watch(self) -> None:
        self.snapshot_timer = QTimer(self)
        self.snapshot_timer.timeout.connect(self.refresh_snapshot)
        self.snapshot_timer.start(1000)

    def _on_riot_state(self, snapshot: GameStateSnapshot) -> None:
        self.riot_state = snapshot
        self.render_snapshot()

    def refresh_snapshot(self, force: bool = False) -> None:
        if not force and not self.store.snapshot_changed():
            return
        self.snapshot = self.store.load_snapshot()
        self.render_snapshot()

    def render_snapshot(self) -> None:
        snap = self.snapshot
        riot = self.riot_state
        fields = fields_for_overlay(
            riot_state=riot.state, live=riot.live, review=snap
        )
        self.player_label.setText(riot.riot_id or snap.player or "snapshot local")
        live_context = riot.queue_name.upper()
        if riot.details.get("game_mode") == "TFT" and riot.details.get("player_count"):
            live_context = f"{live_context} · {riot.details['player_count']} JOGADORES"
        self.rank_label.setText(live_context or snap.rank or "Perfil ainda não conectado")
        if riot.state is GameState.IN_GAME:
            self.live_label.setText("RIOT LIVE · STATS INDISPONÍVEIS")
        elif riot.connected:
            self.live_label.setText("SNAPSHOT · REVISÃO")
        else:
            self.live_label.setText("INDISPONÍVEL")
        self.connection_badge.setText("RIOT CONECTADO" if riot.connected else "RIOT OFFLINE")
        self.status_card.set_snapshot(riot)
        self.focus_title.setText(snap.focus or "Revise uma decisão por vez")
        self.avoid_label.setText(f"Evitar: {snap.avoid}" if snap.avoid else "")
        self.stat_labels["stage"].setText(self._field_text(fields.stage))
        self.stat_labels["hp"].setText(self._field_text(fields.hp))
        self.stat_labels["gold"].setText(self._field_text(fields.gold))
        self.stat_labels["level"].setText(self._field_text(fields.level))
        self.stat_labels["streak"].setText(self._field_text(fields.streak))
        self.score_label.setVisible(riot.state is not GameState.IN_GAME)
        self.score_label.setText("—" if snap.score is None else f"{snap.score}/100")

        board_is_unavailable = fields.board.source is FieldSource.UNAVAILABLE
        self.board_caption.setText(
            "BOARD AO VIVO" if riot.state is GameState.IN_GAME else "BOARD SNAPSHOT"
        )
        self.board_unavailable_label.setVisible(board_is_unavailable)
        self.board_grid_wrap.setVisible(not board_is_unavailable)
        by_slot = {
            unit.slot: unit for unit in (fields.board.value or []) if hasattr(unit, "slot")
        }
        for slot, cell in enumerate(self.board_cells):
            unit = by_slot.get(slot)
            cell.setText(unit.label if unit else "")
            cell.setProperty("occupied", bool(unit))
            cell.setProperty("role", unit.role if unit else "")
            cell.style().unpolish(cell)
            cell.style().polish(cell)

        questions = snap.review_questions[:3]
        for index, label in enumerate(self.review_labels):
            text = questions[index] if index < len(questions) else "—"
            label.setText(f"{index + 1}. {text}")

    @staticmethod
    def _field_text(field: object) -> str:
        value = getattr(field, "value", None)
        source = getattr(field, "source", FieldSource.UNAVAILABLE)
        if source is FieldSource.UNAVAILABLE or value in (None, ""):
            return "—"
        return str(value)

    def _apply_mode(self) -> None:
        self.detail_wrap.setVisible(not self.compact)
        self.stats_wrap.setVisible(not self.compact)
        self.focus_card.setVisible(not self.compact)
        width, height = self.COMPACT_SIZE if self.compact else self.EXPANDED_SIZE
        self.resize(width, height)
        self.compact_button.setText("↗" if self.compact else "↕")

    def toggle_compact(self) -> None:
        self.compact = not self.compact
        self._apply_mode()
        self._save_settings()

    def toggle_lock(self) -> None:
        self.locked = not self.locked
        self.lock_button.setText("🔒" if self.locked else "⌖")
        self._save_settings()

    def set_overlay_opacity(self, value: float) -> None:
        value = max(0.55, min(1.0, value))
        self.setWindowOpacity(value)
        slider_value = round(value * 100)
        if self.opacity_slider.value() != slider_value:
            self.opacity_slider.blockSignals(True)
            self.opacity_slider.setValue(slider_value)
            self.opacity_slider.blockSignals(False)
        self._save_settings()

    def adjust_opacity(self, delta: float) -> None:
        self.set_overlay_opacity(self.windowOpacity() + delta)

    def toggle_visibility(self) -> None:
        self.setVisible(not self.isVisible())
        if self.isVisible():
            self.raise_()
            self.activateWindow()

    def toggle_clickthrough(self) -> None:
        if os.name != "nt":
            return
        self.clickthrough = not self.clickthrough
        self._set_windows_clickthrough(self.clickthrough)
        self.click_button.setText("●" if self.clickthrough else "◌")

    def _set_windows_clickthrough(self, enabled: bool) -> None:
        if os.name != "nt":
            return
        hwnd = int(self.winId())
        GWL_EXSTYLE = -20
        WS_EX_TRANSPARENT = 0x00000020
        WS_EX_LAYERED = 0x00080000
        user32 = ctypes.windll.user32
        style = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
        if enabled:
            style |= WS_EX_TRANSPARENT | WS_EX_LAYERED
        else:
            style &= ~WS_EX_TRANSPARENT
            style |= WS_EX_LAYERED
        user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style)

    def mousePressEvent(self, event: QMouseEvent) -> None:
        if (
            event.button() == Qt.MouseButton.LeftButton
            and not self.locked
            and not self.clickthrough
        ):
            self.drag_origin = event.globalPosition().toPoint()
            self.drag_window_origin = self.pos()
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event: QMouseEvent) -> None:
        if self.drag_origin is not None and self.drag_window_origin is not None:
            delta = event.globalPosition().toPoint() - self.drag_origin
            self.move(self.drag_window_origin + delta)
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event: QMouseEvent) -> None:
        if self.drag_origin is not None:
            self.drag_origin = None
            self.drag_window_origin = None
            self._save_settings()
        super().mouseReleaseEvent(event)

    def _restore_position(self) -> None:
        x = self.settings.get("x")
        y = self.settings.get("y")
        screens = QApplication.screens()
        if isinstance(x, int) and isinstance(y, int) and any(
            screen.availableGeometry().contains(x, y) for screen in screens
        ):
            self.move(x, y)
            return

        screen = QApplication.primaryScreen()
        if screen:
            area = screen.availableGeometry()
            self.move(area.right() - self.EXPANDED_SIZE[0] - 24, area.top() + 64)

    def _save_settings(self) -> None:
        self.store.save_settings(
            {
                "x": self.x(),
                "y": self.y(),
                "opacity": round(self.windowOpacity(), 2),
                "compact": self.compact,
                "locked": self.locked,
                "clickthrough": self.clickthrough,
                "monitor": QApplication.screenAt(self.frameGeometry().center()).name()
                if QApplication.screenAt(self.frameGeometry().center())
                else "",
            }
        )

    def _setup_hotkeys(self) -> None:
        self.hotkey_signals = HotkeySignals()
        self.hotkey_signals.toggle_visibility.connect(self.toggle_visibility)
        self.hotkey_signals.toggle_compact.connect(self.toggle_compact)
        self.hotkey_signals.toggle_clickthrough.connect(self.toggle_clickthrough)
        self.hotkey_signals.opacity_up.connect(lambda: self.adjust_opacity(0.05))
        self.hotkey_signals.opacity_down.connect(lambda: self.adjust_opacity(-0.05))
        if self.demo:
            self.hotkey_signals.advance_demo.connect(self.monitor.advance_demo)

        self.hotkeys = HotkeyManager()
        self.hotkeys.add("ctrl+shift+space", self.hotkey_signals.toggle_visibility.emit)
        self.hotkeys.add("ctrl+shift+c", self.hotkey_signals.toggle_compact.emit)
        self.hotkeys.add("ctrl+shift+l", self.hotkey_signals.toggle_clickthrough.emit)
        self.hotkeys.add("ctrl+shift+up", self.hotkey_signals.opacity_up.emit)
        self.hotkeys.add("ctrl+shift+down", self.hotkey_signals.opacity_down.emit)
        if self.demo:
            self.hotkeys.add("ctrl+shift+d", self.hotkey_signals.advance_demo.emit)

    def show_overlay(self) -> None:
        self.show()
        self.raise_()
        self.activateWindow()

    def request_exit(self) -> None:
        self._quitting = True
        self.close()

    def closeEvent(self, event: QCloseEvent) -> None:
        if self.tray.tray and not self._quitting:
            self.hide()
            event.ignore()
            return
        self._save_settings()
        self.hotkeys.close()
        self.monitor.stop()
        super().closeEvent(event)
