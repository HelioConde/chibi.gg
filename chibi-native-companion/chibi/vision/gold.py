from __future__ import annotations
import cv2
import numpy as np

def isolate_gold(path: str, output: str) -> dict[str,int]:
    image=cv2.imread(path); hsv=cv2.cvtColor(image,cv2.COLOR_BGR2HSV); mask=cv2.inRange(hsv,(12,35,120),(45,255,255)); mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((2,2),np.uint8))
    count,_,stats,_=cv2.connectedComponentsWithStats(mask)
    candidates=[row for row in stats[1:] if row[3]>=8 and row[3]<=image.shape[0]*.9 and row[2]>=2 and row[4]>=12]
    if not candidates:return {"found":count-1,"selected":0}
    x=min(row[0] for row in candidates);y=min(row[1] for row in candidates);r=max(row[0]+row[2] for row in candidates);b=max(row[1]+row[3] for row in candidates)
    crop=image[max(0,y-3):min(image.shape[0],b+3),max(0,x-3):min(image.shape[1],r+3)];cv2.imwrite(output,crop)
    return {"found":count-1,"selected":len(candidates)}
