from __future__ import annotations

from PySide6.QtCore import QEvent, QObject, QThread, Qt, QUrl, Signal
from PySide6.QtGui import QCloseEvent, QGuiApplication, QPixmap
from PySide6.QtNetwork import QNetworkAccessManager, QNetworkRequest
from PySide6.QtWidgets import (
    QFrame, QHBoxLayout, QLabel, QLineEdit, QMainWindow, QPushButton,
    QScrollArea, QStackedWidget, QTabWidget, QVBoxLayout, QWidget,
)

from chibi.assets import TftAssets
from chibi.comps import ChibiCompsClient, Comp, display_name
from chibi.core.settings import Settings
from chibi.plan import GamePlan, GamePlanStore
from chibi.riot.lcu.models import GameState, GameStateSnapshot
from chibi.telemetry.confidence import DataConfidence
from chibi.telemetry.models import TelemetrySnapshot

from .status import PRESENTATION


STYLE = """
QMainWindow { background: #10111a; color: #f4f1ff; }
QWidget { font-family: Segoe UI, Arial; font-size: 12px; color: #e9e5f4; }
QFrame#card, QFrame#unitCard { background: #191b29; border: 1px solid #302c46; border-radius: 10px; }
QLabel#brand { color: #ffffff; font-weight: 700; font-size: 13px; letter-spacing: 1px; }
QLabel#riot { color: #8fdda6; font-size: 10px; font-weight: 600; }
QLabel#state { color: #d3bbff; font-size: 17px; font-weight: 700; }
QLabel#comp { color: #ffffff; font-size: 16px; font-weight: 700; }
QLabel#muted, QLabel#caption { color: #a9a5ba; }
QLabel#caption { font-size: 10px; font-weight: 700; letter-spacing: .6px; }
QPushButton { background: #2b2540; border: 1px solid #5d4b81; border-radius: 7px; padding: 7px 10px; color: #faf7ff; font-weight: 700; }
QPushButton:hover { background: #41345e; }
QPushButton#primary { background: #7052a6; border-color: #9579cb; }
QPushButton#primary:hover { background: #8565bd; }
QPushButton#quiet { padding: 4px 8px; font-size: 10px; }
QTabWidget::pane { border: 1px solid #302c46; border-radius: 8px; background: #151724; top: -1px; }
QTabBar::tab { background: #202132; color: #a9a5ba; padding: 7px 10px; border-top-left-radius: 6px; border-top-right-radius: 6px; }
QTabBar::tab:selected { background: #7052a6; color: white; }
QLineEdit { background: #11121c; border: 1px solid #44385d; padding: 8px; border-radius: 7px; }
QScrollArea { border: none; background: transparent; }
"""


class _CatalogWorker(QObject):
    loaded = Signal(object)
    failed = Signal(str)

    def __init__(self, queue_id: int) -> None:
        super().__init__()
        self.queue_id = queue_id

    def run(self) -> None:
        try:
            self.loaded.emit(ChibiCompsClient().fetch(self.queue_id))
        except Exception:
            self.failed.emit("Não foi possível atualizar as composições agora. O cache local continua disponível.")


class _AssetsWorker(QObject):
    loaded = Signal(object)

    def run(self) -> None:
        assets = TftAssets().load_cache()
        try:
            assets.fetch()
        except Exception:
            pass
        self.loaded.emit(assets)


class _Portrait(QLabel):
    def __init__(self, label: str, url: str) -> None:
        super().__init__(label[:1].upper())
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setFixedSize(34, 34)
        self.setStyleSheet("background: #523d78; border-radius: 17px; color: white; font-size: 14px; font-weight: 700;")
        self.network = QNetworkAccessManager(self)
        if url:
            reply = self.network.get(QNetworkRequest(QUrl(url)))
            reply.finished.connect(lambda response=reply: self._load(response))

    def _load(self, reply: object) -> None:
        pixmap = QPixmap()
        if pixmap.loadFromData(reply.readAll()):
            self.setPixmap(pixmap.scaled(34, 34, Qt.AspectRatioMode.KeepAspectRatioByExpanding, Qt.TransformationMode.SmoothTransformation))
        reply.deleteLater()


class CompanionWindow(QMainWindow):
    plan_changed = Signal(object)

    def __init__(self, plan_store: GamePlanStore | None = None) -> None:
        super().__init__()
        self.plan_store = plan_store or GamePlanStore()
        self.settings = Settings()
        self.plan = GamePlan()
        self.snapshot = GameStateSnapshot.offline()
        self.comps: list[Comp] = ChibiCompsClient().load_cache()
        self._catalog_thread: QThread | None = None
        self.assets = TftAssets().load_cache()
        self._assets_thread: QThread | None = None
        self._compact = False
        self._debug = False
        self._drag_offset = None
        self.setWindowTitle("Chibi Companion")
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.Tool)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setMinimumSize(330, 215)
        self.setMaximumWidth(460)
        self.setStyleSheet(STYLE)
        self._build()
        self._restore_window()
        self._render_comps()
        self._load_assets()

    def _build(self) -> None:
        root = QWidget()
        outer = QVBoxLayout(root)
        outer.setContentsMargins(12, 12, 12, 12)
        outer.setSpacing(8)

        header = QHBoxLayout()
        self.brand = QLabel("C  CHIBI")
        self.brand.setObjectName("brand")
        self.brand.setCursor(Qt.CursorShape.SizeAllCursor)
        self.brand.installEventFilter(self)
        self.riot = QLabel("● RIOT OFFLINE")
        self.riot.setObjectName("riot")
        header.addWidget(self.brand)
        header.addStretch(1)
        header.addWidget(self.riot)
        self.pin_button = QPushButton("PIN")
        self.pin_button.setObjectName("quiet")
        self.pin_button.clicked.connect(self.toggle_pin)
        self.hide_button = QPushButton("×")
        self.hide_button.setObjectName("quiet")
        self.hide_button.clicked.connect(self.hide)
        header.addWidget(self.pin_button)
        header.addWidget(self.hide_button)
        outer.addLayout(header)

        self.status_card = QFrame()
        self.status_card.setObjectName("card")
        status_layout = QVBoxLayout(self.status_card)
        status_layout.setContentsMargins(12, 11, 12, 11)
        self.status = QLabel()
        self.status.setObjectName("state")
        self.detail = QLabel()
        self.detail.setObjectName("muted")
        self.result = QLabel()
        self.result.setObjectName("muted")
        self.open_analysis = QPushButton("ABRIR ANÁLISE")
        self.open_analysis.setObjectName("primary")
        self.result.hide()
        self.open_analysis.hide()
        self.telemetry = QLabel()
        self.telemetry.setObjectName("caption")
        self.telemetry.hide()
        self.collapsed_comp = QLabel()
        self.collapsed_comp.setObjectName("comp")
        self.collapsed_comp.hide()
        self.debug_state = QLabel()
        self.debug_state.setObjectName("caption")
        self.debug_state.hide()
        status_layout.addWidget(self.status)
        status_layout.addWidget(self.detail)
        status_layout.addWidget(self.collapsed_comp)
        status_layout.addWidget(self.telemetry)
        status_layout.addWidget(self.debug_state)
        status_layout.addWidget(self.result)
        status_layout.addWidget(self.open_analysis)
        outer.addWidget(self.status_card)

        self.plan_summary = QFrame()
        self.plan_summary.setObjectName("card")
        summary = QVBoxLayout(self.plan_summary)
        summary.setContentsMargins(12, 10, 12, 10)
        self.comp_caption = QLabel("PLANO")
        self.comp_caption.setObjectName("caption")
        self.comp_name = QLabel()
        self.comp_name.setObjectName("comp")
        self.core_line = QLabel()
        self.core_line.setObjectName("muted")
        self.focus = QLabel()
        self.focus.setObjectName("muted")
        summary.addWidget(self.comp_caption)
        summary.addWidget(self.comp_name)
        summary.addWidget(self.core_line)
        summary.addSpacing(4)
        summary.addWidget(self.focus)
        outer.addWidget(self.plan_summary)

        actions = QHBoxLayout()
        self.plan_button = QPushButton("PLANO")
        self.plan_button.setObjectName("primary")
        self.plan_button.clicked.connect(self.toggle_expanded)
        self.choose_button = QPushButton("ESCOLHER COMPOSIÇÃO")
        self.choose_button.clicked.connect(self.show_selector)
        self.compact_button = QPushButton("RECOLHER")
        self.compact_button.setObjectName("quiet")
        self.compact_button.clicked.connect(self.toggle_compact)
        actions.addWidget(self.plan_button)
        actions.addWidget(self.choose_button)
        actions.addStretch(1)
        actions.addWidget(self.compact_button)
        outer.addLayout(actions)

        self.content = QStackedWidget()
        self.tabs = QTabWidget()
        self.tabs.addTab(self._plan_tab(), "PLANO")
        self.tabs.addTab(self._units_tab(), "UNIDADES")
        self.tabs.addTab(self._items_tab(), "ITENS")
        self.tabs.addTab(self._traits_tab(), "TRAITS")
        self.selector = self._selector_page()
        self.content.addWidget(self.tabs)
        self.content.addWidget(self.selector)
        self.content.hide()
        outer.addWidget(self.content)
        self.setCentralWidget(root)

    def _plan_tab(self) -> QWidget:
        page = QWidget()
        layout = QVBoxLayout(page)
        self.plan_detail = QLabel()
        self.plan_detail.setWordWrap(True)
        layout.addWidget(self.plan_detail)
        layout.addStretch(1)
        return page

    def _units_tab(self) -> QWidget:
        page = QWidget()
        self.units_layout = QVBoxLayout(page)
        self.units_layout.setContentsMargins(10, 10, 10, 10)
        return page

    def _items_tab(self) -> QWidget:
        page = QWidget()
        self.items_layout = QVBoxLayout(page)
        self.items_layout.setContentsMargins(10, 10, 10, 10)
        return page

    def _traits_tab(self) -> QWidget:
        page = QWidget()
        self.traits_layout = QVBoxLayout(page)
        self.traits_layout.setContentsMargins(10, 10, 10, 10)
        return page

    def _selector_page(self) -> QWidget:
        page = QWidget()
        layout = QVBoxLayout(page)
        top = QHBoxLayout()
        title = QLabel("PLANO DA PRÓXIMA PARTIDA")
        title.setObjectName("caption")
        close = QPushButton("VOLTAR")
        close.setObjectName("quiet")
        close.clicked.connect(self.show_plan)
        top.addWidget(title)
        top.addStretch(1)
        top.addWidget(close)
        self.comp_search = QLineEdit()
        self.comp_search.setPlaceholderText("Pesquisar composição...")
        self.comp_search.textChanged.connect(self._render_comps)
        self.selector_status = QLabel("Carregando composições observadas...")
        self.selector_status.setObjectName("muted")
        self.fetch_comps_button = QPushButton("BUSCAR COMPOSIÇÕES")
        self.fetch_comps_button.setObjectName("primary")
        self.fetch_comps_button.clicked.connect(self._load_comps)
        self.comp_list_content = QWidget()
        self.comp_list = QVBoxLayout(self.comp_list_content)
        self.comp_list.setContentsMargins(0, 0, 0, 0)
        self.comp_list.setSpacing(7)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setWidget(self.comp_list_content)
        layout.addLayout(top)
        layout.addWidget(self.comp_search)
        layout.addWidget(self.selector_status)
        layout.addWidget(self.fetch_comps_button)
        layout.addWidget(scroll)
        return page

    def update_gameflow(self, snapshot: GameStateSnapshot) -> None:
        self.snapshot = snapshot
        title, description = PRESENTATION[snapshot.state]
        self.riot.setText("● RIOT CONECTADO" if snapshot.connected else "● RIOT OFFLINE")
        self.riot.setStyleSheet("color: #8fdda6" if snapshot.connected else "color: #bc9aa6")
        self.status.setText(title)
        self.detail.setText(description)
        is_in_game = snapshot.state is GameState.IN_GAME
        self.plan_button.setVisible(is_in_game)
        self.plan_summary.setVisible(is_in_game or bool(self.plan.primary_comp))
        self.choose_button.setText("ESCOLHER PARA PRÓXIMA" if is_in_game else "ESCOLHER COMPOSIÇÃO")
        if not is_in_game:
            self.content.hide()
        if snapshot.state is not GameState.POST_GAME:
            self.result.hide()
            self.open_analysis.hide()
        if snapshot.riot_id:
            self.brand.setText(f"C  CHIBI\n{snapshot.riot_id}")
        if self._debug:
            source = str(snapshot.details.get("state_source") or "LCU")
            self.debug_state.setText(f"STATE SOURCE · {source}")
            self.debug_state.show()
        self._apply_mode()

    def set_live_telemetry(self, snapshot: TelemetrySnapshot) -> None:
        values: list[str] = []
        for field, label in ((snapshot.stage, "stage"), (snapshot.gold, "gold"), (snapshot.level, "level"), (snapshot.hp, "hp")):
            if field.confidence is DataConfidence.VERIFIED and field.value is not None:
                if label == "gold":
                    values.append(f"{field.value}G")
                elif label == "level":
                    values.append(f"LV{field.value}")
                elif label == "hp":
                    values.append(f"{field.value} HP")
                else:
                    values.append(str(field.value))
        self.telemetry.setText(" · ".join(values))
        self.telemetry.setVisible(bool(values))

    def set_game_plan(self, plan: GamePlan) -> None:
        self.plan = plan
        has_plan = bool(plan.primary_comp)
        self.comp_name.setText(plan.primary_comp if has_plan else "Nenhum plano selecionado")
        self.collapsed_comp.setText(plan.primary_comp if has_plan else "Nenhum plano selecionado")
        core = plan.core_units or plan.carries + plan.frontline
        self.core_line.setText("CORE · " + " · ".join(self._name("champion", unit) for unit in core[:4]) if core else "Escolha uma composição para a próxima partida.")
        self.focus.setText("Foco · " + plan.session_focus)
        self.plan_detail.setText(self._plan_text(plan))
        self._render_units(plan)
        self._render_items(plan)
        self._render_traits(plan)

    def _plan_text(self, plan: GamePlan) -> str:
        level = "\n".join(plan.level_plan) or "Plano de level ainda não definido."
        roll = "\n".join(plan.roll_plan) or "Plano de roll ainda não definido."
        return f"COMPOSIÇÃO PRINCIPAL\n{plan.primary_comp or 'Nenhuma composição selecionada'}\n\nPLANO DE LEVEL\n{level}\n\nPLANO DE ROLL\n{roll}\n\nFOCO DA SESSÃO\n{plan.session_focus}"

    def _name(self, kind: str, value: str) -> str:
        return display_name(self.assets.name(kind, value))

    def _comp_name(self, comp: Comp) -> str:
        names = [self._name("trait", trait) for trait in comp.traits[:2]]
        return " + ".join(names) or comp.name

    @staticmethod
    def _clear_layout(layout: QVBoxLayout) -> None:
        while layout.count():
            item = layout.takeAt(0)
            widget = item.widget()
            if widget:
                widget.deleteLater()
            child_layout = item.layout()
            if child_layout:
                while child_layout.count():
                    child = child_layout.takeAt(0)
                    child_widget = child.widget()
                    if child_widget:
                        child_widget.deleteLater()

    def _render_units(self, plan: GamePlan) -> None:
        self._clear_layout(self.units_layout)
        groups = (("CARRY", plan.carries), ("FRONTLINE", plan.frontline), ("CORE", plan.core_units), ("FLEX / ALTERNATIVAS", plan.fallback_comps))
        any_units = False
        for title, values in groups:
            if not values:
                continue
            any_units = True
            caption = QLabel(title)
            caption.setObjectName("caption")
            self.units_layout.addWidget(caption)
            row = QHBoxLayout()
            for value in values[:5]:
                row.addWidget(self._unit_card(value))
            row.addStretch(1)
            self.units_layout.addLayout(row)
        if not any_units:
            empty = QLabel("Escolha um plano para ver as unidades principais.")
            empty.setObjectName("muted")
            self.units_layout.addWidget(empty)
        self.units_layout.addStretch(1)

    def _unit_card(self, value: str, kind: str = "champion") -> QFrame:
        card = QFrame()
        card.setObjectName("unitCard")
        layout = QVBoxLayout(card)
        layout.setContentsMargins(7, 6, 7, 6)
        name_value = self._name(kind, value)
        portrait = _Portrait(name_value, self.assets.url(kind, value))
        name = QLabel(name_value)
        name.setAlignment(Qt.AlignmentFlag.AlignCenter)
        name.setMaximumWidth(75)
        name.setWordWrap(True)
        layout.addWidget(portrait, alignment=Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(name)
        return card

    def _render_items(self, plan: GamePlan) -> None:
        self._clear_layout(self.items_layout)
        has_items = False
        for title, values in (("CARRY", plan.carry_items), ("TANK", plan.tank_items)):
            if not values:
                continue
            has_items = True
            caption = QLabel(title)
            caption.setObjectName("caption")
            row = QHBoxLayout()
            for value in values[:3]:
                row.addWidget(self._unit_card(value, "item"))
            row.addStretch(1)
            self.items_layout.addWidget(caption)
            self.items_layout.addLayout(row)
        if not has_items:
            empty = QLabel("Os itens principais aparecerão aqui ao escolher uma composição.")
            empty.setObjectName("muted")
            self.items_layout.addWidget(empty)
        self.items_layout.addStretch(1)

    def _render_traits(self, plan: GamePlan) -> None:
        self._clear_layout(self.traits_layout)
        if not plan.traits:
            empty = QLabel("As traits importantes aparecerão aqui ao escolher uma composição.")
            empty.setObjectName("muted")
            self.traits_layout.addWidget(empty)
        else:
            row = QHBoxLayout()
            for trait in plan.traits:
                row.addWidget(self._unit_card(trait, "trait"))
            row.addStretch(1)
            self.traits_layout.addLayout(row)
        self.traits_layout.addStretch(1)

    def toggle_expanded(self) -> None:
        if self.content.isVisible() and self.content.currentWidget() is self.tabs:
            self.content.hide()
        else:
            self.show_plan()

    def show_plan(self) -> None:
        self.content.setCurrentWidget(self.tabs)
        self.content.show()
        self._compact = False
        self._apply_mode()

    def show_selector(self) -> None:
        self.content.setCurrentWidget(self.selector)
        self.content.show()
        self._compact = False
        self._apply_mode()
        self._load_comps()

    def toggle_compact(self) -> None:
        self._compact = not self._compact
        self.content.hide()
        self._apply_mode()

    def _apply_mode(self) -> None:
        expanded = self.content.isVisible()
        self.compact_button.setText("EXPANDIR" if self._compact else "RECOLHER")
        self.plan_summary.setVisible(not self._compact and (self.snapshot.state is GameState.IN_GAME or bool(self.plan.primary_comp)))
        self.collapsed_comp.setVisible(self._compact and self.snapshot.state is GameState.IN_GAME)
        self.choose_button.setVisible(not self._compact)
        self.plan_button.setVisible(not self._compact and self.snapshot.state is GameState.IN_GAME)
        self.setMinimumWidth(400 if expanded else 335)
        self.resize(430 if expanded else 350, 470 if expanded else (155 if self._compact else 255))

    def _load_comps(self) -> None:
        if self._catalog_thread and self._catalog_thread.isRunning():
            return
        if self.comps:
            self.selector_status.setText(f"{len(self.comps)} composições no cache local. Atualizando…")
        worker = _CatalogWorker(self.snapshot.queue_id or 1100)
        thread = QThread(self)
        worker.moveToThread(thread)
        thread.started.connect(worker.run)
        worker.loaded.connect(self._on_comps_loaded)
        worker.failed.connect(self._on_comps_failed)
        worker.loaded.connect(thread.quit)
        worker.failed.connect(thread.quit)
        thread.finished.connect(worker.deleteLater)
        thread.finished.connect(thread.deleteLater)
        self._catalog_thread = thread
        thread.start()

    def _on_comps_loaded(self, comps: list[Comp]) -> None:
        self.comps = comps
        self.selector_status.setText(f"{len(comps)} composições observadas no Chibi Dataset." if comps else "Ainda não há comps suficientes nesse contexto.")
        self.fetch_comps_button.setText("ATUALIZAR COMPOSIÇÕES")
        self._render_comps()

    def _on_comps_failed(self, message: str) -> None:
        self.selector_status.setText(message)

    def _load_assets(self) -> None:
        if self._assets_thread and self._assets_thread.isRunning():
            return
        worker = _AssetsWorker()
        thread = QThread(self)
        worker.moveToThread(thread)
        thread.started.connect(worker.run)
        worker.loaded.connect(self._on_assets_loaded)
        worker.loaded.connect(thread.quit)
        thread.finished.connect(worker.deleteLater)
        thread.finished.connect(thread.deleteLater)
        self._assets_thread = thread
        thread.start()

    def _on_assets_loaded(self, assets: TftAssets) -> None:
        self.assets = assets
        self.set_game_plan(self.plan)
        self._render_comps()

    def _render_comps(self) -> None:
        if not hasattr(self, "comp_list"):
            return
        self._clear_layout(self.comp_list)
        query = self.comp_search.text().casefold()
        visible = [comp for comp in self.comps if query in (comp.name + " " + " ".join(comp.units)).casefold()]
        if not visible:
            if not self.comps:
                self.selector_status.setText("Nenhuma composição em cache ainda.")
            return
        for comp in visible:
            card = QFrame()
            card.setObjectName("card")
            layout = QVBoxLayout(card)
            layout.setContentsMargins(10, 9, 10, 9)
            title = QLabel(self._comp_name(comp))
            title.setObjectName("comp")
            units = QLabel(" · ".join(self._name("champion", unit) for unit in comp.units[:5]))
            units.setObjectName("muted")
            carry = self._name("champion", comp.units[0]) if comp.units else "—"
            evidence = QLabel(f"CARRY · {carry}   ·   {comp.games} partidas observadas")
            evidence.setObjectName("caption")
            choose = QPushButton("USAR COMO PLANO")
            choose.setObjectName("primary")
            choose.clicked.connect(lambda _checked=False, candidate=comp: self._select_comp(candidate))
            layout.addWidget(title)
            layout.addWidget(units)
            layout.addWidget(evidence)
            layout.addWidget(choose)
            self.comp_list.addWidget(card)
        self.comp_list.addStretch(1)

    def _select_comp(self, comp: Comp) -> None:
        plan = comp.to_plan()
        plan.primary_comp = self._comp_name(comp)
        self.plan_store.save(plan)
        self.set_game_plan(plan)
        self.plan_changed.emit(plan)
        self.show_plan()

    def show_result(self, result: object) -> None:
        placement = getattr(result, "placement", "—")
        level = getattr(result, "level", "—")
        self.status.setText("PARTIDA FINALIZADA")
        self.detail.setText(f"{placement}º lugar · Nível final {level}")
        self.result.setText("A análise da partida está pronta no seu perfil Chibi.")
        self.result.show()
        self.open_analysis.show()
        self.show()

    def _restore_window(self) -> None:
        saved = self.settings.load()
        geometry = saved.get("geometry")
        if isinstance(geometry, list) and len(geometry) == 4 and all(isinstance(value, int) for value in geometry):
            x, y, width, height = geometry
            candidate = self.geometry()
            candidate.setRect(x, y, width, height)
            if any(screen.availableGeometry().intersects(candidate) for screen in QGuiApplication.screens()):
                self.setGeometry(candidate)
        self._compact = bool(saved.get("compact", False))
        self._apply_mode()

    def _save_window(self) -> None:
        rect = self.geometry()
        self.settings.update({"geometry": [rect.x(), rect.y(), rect.width(), rect.height()], "compact": self._compact, "pinned": self.pin_button.text() == "PINNED"})

    def closeEvent(self, event: QCloseEvent) -> None:
        self._save_window()
        self.hide()
        event.ignore()

    def toggle_click_through(self) -> None:
        flags = self.windowFlags()
        transparent = bool(flags & Qt.WindowType.WindowTransparentForInput)
        self.setWindowFlag(Qt.WindowType.WindowTransparentForInput, not transparent)
        self.show()

    def set_debug(self, enabled: bool) -> None:
        self._debug = enabled
        self.debug_state.setVisible(enabled and bool(self.snapshot.details))

    def toggle_pin(self) -> None:
        pinned = self.pin_button.text() != "PINNED"
        self.pin_button.setText("PINNED" if pinned else "PIN")
        self.setWindowFlag(Qt.WindowType.WindowStaysOnTopHint, pinned)
        self.show()

    def eventFilter(self, watched: object, event: object) -> bool:
        if watched is self.brand and event.type() == QEvent.Type.MouseButtonPress and event.button() == Qt.MouseButton.LeftButton:
            self._drag_offset = event.globalPosition().toPoint() - self.frameGeometry().topLeft()
            return True
        if watched is self.brand and event.type() == QEvent.Type.MouseMove and self._drag_offset is not None and event.buttons() & Qt.MouseButton.LeftButton:
            self.move(event.globalPosition().toPoint() - self._drag_offset)
            return True
        if watched is self.brand and event.type() == QEvent.Type.MouseButtonRelease:
            self._drag_offset = None
            self._save_window()
            return True
        return super().eventFilter(watched, event)

    def move_to_preset(self, preset: str) -> None:
        screen = QGuiApplication.primaryScreen()
        if screen is None:
            return
        available = screen.availableGeometry()
        margin = 18
        if preset == "top-left":
            x, y = available.x() + margin, available.y() + margin
        elif preset == "bottom-right":
            x = available.right() - self.width() - margin
            y = available.bottom() - self.height() - margin
        else:
            x = available.right() - self.width() - margin
            y = available.y() + margin
        self.move(x, y)
        self._save_window()
