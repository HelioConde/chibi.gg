@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo [chibi] Criando ambiente virtual...
  py -3 -m venv .venv || goto :error
  call ".venv\Scripts\activate.bat"
  python -m pip install --upgrade pip
  pip install -r requirements.txt || goto :error
) else (
  call ".venv\Scripts\activate.bat"
)

python app.py %*
exit /b %errorlevel%

:error
echo.
echo [chibi] Nao foi possivel iniciar o overlay.
pause
exit /b 1
