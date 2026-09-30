from __future__ import annotations

from PySide6.QtCore import Signal
from PySide6.QtWidgets import (
    QDialog, QFormLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton, QVBoxLayout, QWidget
)

from chibi.auth.client import ChibiAuthClient, ChibiAuthError
from chibi.auth.secure_store import SecureTokenStore


class CompanionAccountDialog(QDialog):
    session_changed = Signal()

    def __init__(
        self,
        store: SecureTokenStore,
        client: ChibiAuthClient | None = None,
        parent=None,
    ) -> None:
        super().__init__(parent)
        self.store = store
        self.client = client or ChibiAuthClient()
        self.setWindowTitle("Conta Chibi")
        self.setMinimumWidth(360)
        self._build()
        self._refresh()

    def _build(self) -> None:
        root = QVBoxLayout(self)
        self.title = QLabel("CONTA CHIBI")
        self.message = QLabel()
        self.message.setWordWrap(True)
        root.addWidget(self.title)
        root.addWidget(self.message)

        self.form_widget = QWidget()
        form_layout = QFormLayout(self.form_widget)
        self.email = QLineEdit()
        self.email.setPlaceholderText("seu@email.com")
        self.password = QLineEdit()
        self.password.setEchoMode(QLineEdit.EchoMode.Password)
        self.password.setPlaceholderText("Senha da conta Chibi")
        form_layout.addRow("E-mail", self.email)
        form_layout.addRow("Senha", self.password)
        root.addWidget(self.form_widget)

        actions = QHBoxLayout()
        self.login_button = QPushButton("ENTRAR")
        self.login_button.clicked.connect(self._login)
        self.logout_button = QPushButton("SAIR")
        self.logout_button.clicked.connect(self._logout)
        self.close_button = QPushButton("FECHAR")
        self.close_button.clicked.connect(self.close)
        actions.addWidget(self.login_button)
        actions.addWidget(self.logout_button)
        actions.addStretch(1)
        actions.addWidget(self.close_button)
        root.addLayout(actions)

    def _refresh(self) -> None:
        session = self.store.load_session()
        connected = session is not None
        self.form_widget.setVisible(not connected)
        self.login_button.setVisible(not connected)
        self.logout_button.setVisible(connected)
        self.message.setText(
            "Conta conectada. As partidas finalizadas poderão ser enviadas ao seu perfil Chibi."
            if connected
            else "Entre com a mesma conta criada no chibi.gg. A senha é usada somente para autenticar e não é salva."
        )

    def _login(self) -> None:
        email = self.email.text().strip()
        password = self.password.text()
        if not email or not password:
            self.message.setText("Informe e-mail e senha.")
            return
        self.login_button.setEnabled(False)
        self.message.setText("Conectando...")
        try:
            session = self.client.login(email, password)
            self.store.save_session(session)
            self.password.clear()
            self.message.setText("Conta Chibi conectada.")
            self.session_changed.emit()
            self._refresh()
        except ChibiAuthError as error:
            self.message.setText(str(error))
        finally:
            self.login_button.setEnabled(True)

    def _logout(self) -> None:
        session = self.store.load_session()
        if session:
            self.client.logout(session.access_token)
        self.store.clear_session()
        self.session_changed.emit()
        self._refresh()
