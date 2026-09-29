from __future__ import annotations

import re


ROUND = re.compile(r"^([1-9]|1[0-9])-([1-9]|1[0-9])$")


def valid_level(value: object) -> bool:
    return isinstance(value, int) and 1 <= value <= 10


def valid_gold(value: object) -> bool:
    return isinstance(value, int) and 0 <= value <= 999


def parse_round(value: object) -> str | None:
    match = ROUND.fullmatch(str(value).strip())
    return match.group(0) if match else None
