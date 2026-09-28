from __future__ import annotations
import json
from dataclasses import asdict
from pathlib import Path
from chibi.core.settings import app_data_dir
from .window import find_tft_window

def vision_debug_report() -> Path:
    window=find_tft_window()
    try: import mss # type: ignore[import-not-found]
    except ImportError: capture={"available":False,"reason":"mss_not_installed"}
    else: capture={"available":True,"backend":"mss"}
    data={"game_window":asdict(window) if window else None,"capture":capture,"fields":{"stage":"unavailable","gold":"unavailable","level":"unavailable","shop":"unavailable"},"confidence":"unavailable","note":"Experimental read-only window capture. No OCR was run."}
    path=app_data_dir()/"debug"/"vision"/"vision-report.json"; path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8"); return path
