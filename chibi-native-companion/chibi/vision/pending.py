from __future__ import annotations
import json
from pathlib import Path
from time import time
from uuid import uuid4
import cv2
from chibi.core.settings import app_data_dir
from .templates import HudTemplateStore

def create_pending(field:str,image_path:str)->str:
    image=cv2.imread(image_path); gray=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY); _,mask=cv2.threshold(gray,180,255,cv2.THRESH_BINARY); count,_,stats,_=cv2.connectedComponentsWithStats(mask)
    rows=sorted([row for row in stats[1:] if row[2]>=2 and row[3]>=5 and row[4]>=8],key=lambda row:row[0]); sample=uuid4().hex[:12]; root=app_data_dir()/"debug"/"vision"/"pending"/sample; root.mkdir(parents=True,exist_ok=True)
    components=[]
    for index,row in enumerate(rows):
        x,y,w,h,area=map(int,row); path=root/f"component_{index}.png"; cv2.imwrite(str(path),image[y:y+h,x:x+w]); components.append({"index":index,"bbox":[x,y,w,h],"image_path":str(path)})
    (root/"meta.json").write_text(json.dumps({"sample_id":sample,"field":field,"frame_timestamp":time(),"resolution":f"{image.shape[1]}x{image.shape[0]}","components":components,"normalization_version":1},indent=2),encoding="utf-8"); return sample

def label_pending(sample_id:str,label:str)->list[Path]:
    meta=app_data_dir()/"debug"/"vision"/"pending"/sample_id/"meta.json"; data=json.loads(meta.read_text(encoding="utf-8")); glyphs=["dash" if char in "-–—" else char for char in label.strip() if char.isdigit() or char in "-–—"]
    components=data.get("components",[])
    if not glyphs or len(glyphs)!=len(components): raise ValueError("label_component_count_mismatch")
    store=HudTemplateStore(); return [store.save(glyph,cv2.imread(component["image_path"]),str(data["field"]),str(data["resolution"])) for glyph,component in zip(glyphs,components)]
