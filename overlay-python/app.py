from __future__ import annotations

import argparse
import logging
import sys

from PySide6.QtWidgets import QApplication

from chibi_overlay.storage import LocalStore
from chibi_overlay.window import OverlayWindow
from chibi_overlay.riot.connection import LcuUnavailableError
from chibi_overlay.riot.debug import write_sanitized_gameflow_session


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Chibi Companion desktop overlay")
    parser.add_argument(
        "--snapshot",
        help="Path to a local snapshot JSON file. If omitted, Chibi uses the user AppData folder.",
    )
    parser.add_argument("--debug", action="store_true", help="Enable detailed Companion logs.")
    parser.add_argument(
        "--debug-lcu",
        action="store_true",
        help="Save a sanitized gameflow session payload in the Chibi debug folder and exit.",
    )
    parser.add_argument("--demo", action="store_true", help="Run without Riot Client; Ctrl+Shift+D advances game states.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.debug else logging.INFO,
        format="%(message)s",
    )

    if args.debug_lcu:
        store = LocalStore(snapshot_path=args.snapshot, demo=args.demo)
        try:
            path = write_sanitized_gameflow_session(store.settings_path.parent / "debug")
        except LcuUnavailableError as error:
            logging.error("[LCU DEBUG] unavailable: %s", error)
            return 1
        logging.info("[LCU DEBUG] sanitized session saved: %s", path)
        return 0

    app = QApplication(sys.argv)
    app.setApplicationName("Chibi Companion")
    app.setOrganizationName("chibi.gg")

    store = LocalStore(snapshot_path=args.snapshot, demo=args.demo)
    window = OverlayWindow(store, demo=args.demo)
    window.show()

    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
