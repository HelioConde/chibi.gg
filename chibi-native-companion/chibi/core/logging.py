from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler

from .settings import app_data_dir


def configure(debug: bool = False) -> None:
    directory = app_data_dir() / "logs"
    directory.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(directory / "chibi-native.log", maxBytes=512_000, backupCount=3, encoding="utf-8")
    logging.basicConfig(level=logging.DEBUG if debug else logging.INFO, format="%(message)s", handlers=[handler])
