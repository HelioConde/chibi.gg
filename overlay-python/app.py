from __future__ import annotations

import argparse
import logging
import sys

from PySide6.QtWidgets import QApplication

from chibi_overlay.storage import LocalStore
from chibi_overlay.window import OverlayWindow


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Chibi Companion desktop overlay")
    parser.add_argument(
        "--snapshot",
        help="Path to a local snapshot JSON file. If omitted, Chibi uses the user AppData folder.",
    )
    parser.add_argument("--debug", action="store_true", help="Enable detailed Companion logs.")
    parser.add_argument("--demo", action="store_true", help="Run without Riot Client; Ctrl+Shift+D advances game states.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.debug else logging.INFO,
        format="%(message)s",
    )

    app = QApplication(sys.argv)
    app.setApplicationName("Chibi Companion")
    app.setOrganizationName("chibi.gg")

    store = LocalStore(snapshot_path=args.snapshot, demo=args.demo)
    window = OverlayWindow(store, demo=args.demo)
    window.show()

    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
