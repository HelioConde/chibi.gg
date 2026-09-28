from __future__ import annotations
import ctypes
import ctypes.wintypes
from dataclasses import asdict, dataclass

@dataclass(frozen=True)
class GameWindow:
    handle:int; title:str; left:int; top:int; width:int; height:int

def find_tft_window() -> GameWindow | None:
    found:list[GameWindow]=[]; user32=ctypes.windll.user32
    callback_type=ctypes.WINFUNCTYPE(ctypes.c_bool,ctypes.c_void_p,ctypes.c_void_p)
    def visit(handle: int, _context: int) -> bool:
        if not user32.IsWindowVisible(handle) or user32.IsIconic(handle): return True
        size=user32.GetWindowTextLengthW(handle)
        if not size:return True
        title=ctypes.create_unicode_buffer(size+1); user32.GetWindowTextW(handle,title,size+1)
        if "league of legends" not in title.value.casefold(): return True
        rect=ctypes.wintypes.RECT(); user32.GetWindowRect(handle,ctypes.byref(rect))
        if rect.left>-30000 and rect.top>-30000 and rect.right>rect.left and rect.bottom>rect.top: found.append(GameWindow(handle,title.value,rect.left,rect.top,rect.right-rect.left,rect.bottom-rect.top))
        return True
    user32.EnumWindows(callback_type(visit),0)
    return max(found,key=lambda item:item.width*item.height,default=None)
