from __future__ import annotations
import json
from pathlib import Path
from time import time
from chibi.core.settings import app_data_dir

class HudTemplateStore:
    """Local, explicitly labelled HUD glyph templates; never inferred from game state."""
    def __init__(self) -> None: self.root=app_data_dir()/"vision-templates"/"hud"
    def save(self,label:str,image,field:str,resolution:str)->Path:
        if label not in set("0123456789")|{"dash"}: raise ValueError("unsupported_hud_glyph")
        directory=self.root/label; directory.mkdir(parents=True,exist_ok=True); stamp=str(int(time()*1000)); path=directory/(stamp+".png")
        import cv2; cv2.imwrite(str(path),image); path.with_suffix(".json").write_text(json.dumps({"label":label,"created_at":time(),"source_field":field,"source_resolution":resolution,"normalization_version":1}),encoding="utf-8"); return path
