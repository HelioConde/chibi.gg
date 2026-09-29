from __future__ import annotations
import ctypes
import ctypes.wintypes
from dataclasses import dataclass
import psutil

GAME_PROCESS_NAMES={"tftclient-win64-shipping.exe","league of legends.exe","leagueclient.exe","leagueclientux.exe","leagueclientuxrender.exe"}

@dataclass(frozen=True)
class GameWindow:
    handle:int; pid:int; process_name:str; title:str; left:int; top:int; width:int; height:int; dpi_scale:float; visible:bool; minimized:bool

def find_tft_window() -> GameWindow | None:
    user32=ctypes.windll.user32; found:list[GameWindow]=[]; callback=ctypes.WINFUNCTYPE(ctypes.c_bool,ctypes.c_void_p,ctypes.c_void_p)
    def visit(handle:int,_:int)->bool:
        if not user32.IsWindowVisible(handle) or user32.IsIconic(handle): return True
        pid=ctypes.wintypes.DWORD(); user32.GetWindowThreadProcessId(handle,ctypes.byref(pid))
        try: name=psutil.Process(pid.value).name()
        except (psutil.Error,OSError): return True
        if name.casefold() not in GAME_PROCESS_NAMES:return True
        rect=ctypes.wintypes.RECT(); user32.GetClientRect(handle,ctypes.byref(rect)); point=ctypes.wintypes.POINT(); user32.ClientToScreen(handle,ctypes.byref(point))
        width,height=rect.right-rect.left,rect.bottom-rect.top
        if width<640 or height<360:return True
        size=user32.GetWindowTextLengthW(handle); title=ctypes.create_unicode_buffer(size+1); user32.GetWindowTextW(handle,title,size+1); dpi=user32.GetDpiForWindow(handle) if hasattr(user32,"GetDpiForWindow") else 96
        found.append(GameWindow(handle,pid.value,name,title.value,point.x,point.y,width,height,dpi/96,True,False)); return True
    user32.EnumWindows(callback(visit),0); return max(found,key=lambda item:item.width*item.height,default=None)
