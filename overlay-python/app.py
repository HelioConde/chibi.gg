from __future__ import annotations

import argparse
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
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    app = QApplication(sys.argv)
    app.setApplicationName("Chibi Companion")
    app.setOrganizationName("chibi.gg")

    store = LocalStore(snapshot_path=args.snapshot)
    window = OverlayWindow(store)
    window.show()

    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
