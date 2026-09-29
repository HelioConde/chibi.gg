from __future__ import annotations
from dataclasses import dataclass
from .window import GameWindow

@dataclass(frozen=True)
class CapturedFrame: width:int; height:int; variance:float; rgb:bytes
class VisionCapture:
    def capture(self,window:GameWindow)->CapturedFrame:
        import mss
        with mss.mss() as screen:
            image=screen.grab({"left":window.left,"top":window.top,"width":window.width,"height":window.height}); values=bytes(image.rgb)[::max(3,len(image.rgb)//10000*3)][::3]; mean=sum(values)/max(1,len(values)); variance=sum((value-mean)**2 for value in values)/max(1,len(values))
            if variance<4: raise RuntimeError("captured_frame_low_variance")
            return CapturedFrame(image.width,image.height,variance,bytes(image.rgb))
