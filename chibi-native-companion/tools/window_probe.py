from __future__ import annotations
import ctypes
import ctypes.wintypes as wt
import psutil

u=ctypes.windll.user32
def info(h:int):
    pid=wt.DWORD();u.GetWindowThreadProcessId(h,ctypes.byref(pid)); r=wt.RECT();c=wt.RECT();u.GetWindowRect(h,ctypes.byref(r));u.GetClientRect(h,ctypes.byref(c));p=wt.POINT();u.ClientToScreen(h,ctypes.byref(p)); b=ctypes.create_unicode_buffer(512);u.GetWindowTextW(h,b,512);k=ctypes.create_unicode_buffer(256);u.GetClassNameW(h,k,256)
    try: proc=psutil.Process(pid.value); name,exe=proc.name(),proc.exe()
    except (psutil.Error,OSError):name,exe="?",""
    return {"hwnd":hex(h),"pid":pid.value,"process":name,"exe":exe,"title":b.value,"class":k.value,"visible":bool(u.IsWindowVisible(h)),"minimized":bool(u.IsIconic(h)),"client":f"{c.right-c.left}x{c.bottom-c.top}","screen":f"{p.x},{p.y}"}
foreground=u.GetForegroundWindow();print("FOREGROUND WINDOW",info(foreground))
rows=[];CB=ctypes.WINFUNCTYPE(ctypes.c_bool,ctypes.c_void_p,ctypes.c_void_p)
def visit(h,l):
    row=info(h)
    if "league" in row["process"].casefold() or "riot" in row["process"].casefold() or h==foreground:rows.append(row)
    return True
u.EnumWindows(CB(visit),0)
print("TOP CANDIDATES");[print(row) for row in rows]
