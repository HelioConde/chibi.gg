$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host "== Chibi Native Companion build ==" -ForegroundColor Cyan

$py = Get-Command py -ErrorAction SilentlyContinue
if (-not $py) {
    throw "Python Launcher (py.exe) não encontrado. Instale Python 3.12 e tente novamente."
}

$python312 = & py -3.12 -c "import sys; print(sys.executable)" 2>$null
if ($LASTEXITCODE -ne 0 -or -not $python312) {
    Write-Host ""
    Write-Host "Python 3.12 não encontrado." -ForegroundColor Yellow
    Write-Host "Versões detectadas:" -ForegroundColor Yellow
    & py -0p
    throw "O projeto/CI usa Python 3.12. Instale Python 3.12 e execute este script novamente."
}

$venvPython = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "Criando .venv com Python 3.12..."
    & py -3.12 -m venv .venv
}

Write-Host "Atualizando pip..."
& $venvPython -m pip install --upgrade pip

Write-Host "Instalando dependências..."
& $venvPython -m pip install -r requirements.txt

Write-Host "Rodando compileall..."
& $venvPython -m compileall -q .

Write-Host "Rodando testes..."
& $venvPython -m pytest -q

Write-Host "Gerando executável..."
& $venvPython -m PyInstaller --noconfirm ChibiNativeCompanion.spec

$exe = Join-Path $Root "dist\ChibiCompanion\ChibiCompanion.exe"
if (-not (Test-Path $exe)) {
    throw "Build terminou sem encontrar $exe"
}

Write-Host ""
Write-Host "BUILD OK" -ForegroundColor Green
Write-Host $exe -ForegroundColor Green
