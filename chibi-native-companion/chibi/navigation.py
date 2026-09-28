from __future__ import annotations

from urllib.parse import urlencode

WEB_BASE = "https://chibi.gg/"


def build_analysis_url(game_name: str, tag_line: str, platform: str, match_id: str, session_focus: str = "") -> str:
    """Build the established Chibi Study deep link with safe URL encoding."""
    values = {
        "player": game_name.strip(),
        "tag": tag_line.strip(),
        "region": platform.strip().lower(),
        "tab": "matches",
        "study": match_id.strip(),
        "source": "native",
    }
    if session_focus.strip(): values["sessionFocus"] = session_focus.strip()
    return WEB_BASE + "?" + urlencode(values)
