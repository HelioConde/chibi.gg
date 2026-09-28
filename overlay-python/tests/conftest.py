"""Make the standalone overlay package importable from the repository root."""

from __future__ import annotations

import sys
from pathlib import Path


OVERLAY_ROOT = Path(__file__).resolve().parents[1]
if str(OVERLAY_ROOT) not in sys.path:
    sys.path.insert(0, str(OVERLAY_ROOT))
