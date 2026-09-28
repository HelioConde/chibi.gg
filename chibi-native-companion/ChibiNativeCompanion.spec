# -*- mode: python ; coding: utf-8 -*-
a = Analysis(['app.py'], pathex=[], binaries=[], datas=[], hiddenimports=[], hookspath=[], hooksconfig={}, runtime_hooks=[], excludes=[], noarchive=False)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='ChibiCompanion', console=False)
coll = COLLECT(exe, a.binaries, a.datas, name='ChibiCompanion')
