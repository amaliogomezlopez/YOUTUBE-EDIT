$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$setupScript = Join-Path $projectRoot "scripts\setup-faster-whisper.ps1"
$pythonPath = Join-Path $projectRoot ".venv-whisper\Scripts\python.exe"

& $setupScript

Write-Host "Instalando runtime CUDA/cuDNN para CTranslate2..."
try {
  & $pythonPath -m pip install --upgrade nvidia-cublas-cu12 nvidia-cudnn-cu12
  if ($LASTEXITCODE -ne 0) { throw "pip CUDA exit $LASTEXITCODE" }
  Write-Host "Faster-Whisper GPU listo. Usa CUDA + float16 por defecto."
} catch {
  Write-Warning "No se pudieron instalar las ruedas CUDA. Faster-Whisper sigue en CPU."
}
Write-Host "Python: $pythonPath"
