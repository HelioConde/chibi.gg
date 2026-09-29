from __future__ import annotations
from dataclasses import dataclass
import cv2

@dataclass(frozen=True)
class HudRecognitionResult: text:str|None; confidence:float; backend:str="hud-template"

class HudDigitRecognizer:
    def recognize(self,image,templates:dict[str,list[object]])->HudRecognitionResult:
        if not templates:return HudRecognitionResult(None,0.0)
        best=(None,-1.0)
        for label,rows in templates.items():
            for template in rows:
                resized=cv2.resize(image,(template.shape[1],template.shape[0])); score=float(cv2.matchTemplate(resized,template,cv2.TM_CCOEFF_NORMED)[0][0])
                if score>best[1]:best=(label,score)
        return HudRecognitionResult(best[0],max(0.0,best[1]))
