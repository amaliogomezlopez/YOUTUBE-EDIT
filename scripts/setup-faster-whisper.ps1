$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPath = Join-Path $projectRoot ".venv-whisper"
$pythonPath = Join-Path $venvPath "Scripts\python.exe"

if (-not (Test-Path -LiteralPath $pythonPath)) {
  Write-Host "Creando entorno local en $venvPath"
  python -m venv $venvPath
}

Write-Host "Actualizando pip…"
& $pythonPath -m pip install --upgrade pip
Write-Host "Instalando Faster-Whisper…"
& $pythonPath -m pip install --upgrade faster-whisper

Write-Host "Faster-Whisper listo. El modelo se descargará localmente en el primer uso."
Write-Host "Python: $pythonPath"
