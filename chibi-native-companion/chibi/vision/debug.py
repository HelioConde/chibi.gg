from __future__ import annotations
import json
from dataclasses import asdict
from chibi.core.settings import app_data_dir
from .capture import VisionCapture
from .window import find_tft_window

def _save_png(path, rgb, width, height):
    import mss.tools
    mss.tools.to_png(rgb, (width,height), output=str(path))

def vision_debug_report():
    window=find_tft_window(); fields={name:{"candidate":None,"error":"no_frame"} for name in ("stage","gold","level","shop")}
    data={"game_window":asdict(window) if window else None,"capture":{"available":False,"reason":"no_visible_tft_game_window"},"fields":fields,"confidence":"unavailable"}
    if window:
        try:
            frame=VisionCapture().capture(window); root=app_data_dir()/"debug"/"vision"; root.mkdir(parents=True,exist_ok=True); _save_png(root/"frame.png",frame.rgb,frame.width,frame.height)
            regions={"stage":(.36,.00,.08,.05),"gold":(.50,.79,.07,.07),"level":(.18,.79,.12,.07),"shop":(.12,.84,.76,.16)}
            for name,(x,y,w,h) in regions.items():
                left,top,width,height=round(x*frame.width),round(y*frame.height),round(w*frame.width),round(h*frame.height); crop=bytearray()
                for row in range(top,top+height): crop.extend(frame.rgb[(row*frame.width+left)*3:(row*frame.width+left+width)*3])
                _save_png(root/(name+"-region.png"),bytes(crop),width,height)
            data["capture"]={"available":True,"width":frame.width,"height":frame.height,"variance":round(frame.variance,2),"frame":str(root/"frame.png")}; data["fields"]={name:{"candidate":None,"error":"ocr_backend_not_available"} for name in fields}
        except Exception as error: data["capture"]={"available":False,"reason":str(error)}
    path=app_data_dir()/"debug"/"vision"/"vision-report.json"; path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8"); return path
