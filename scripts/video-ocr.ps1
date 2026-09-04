param([Parameter(Mandatory=$true)][string]$Directory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
$asTaskMethod = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation' + [char]96 + '1' })[0]
function Await-Result($Operation, $Type) {
  $task = $asTaskMethod.MakeGenericMethod($Type).Invoke($null, @($Operation))
  $task.Wait()
  return $task.Result
}
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) { throw 'No hay idioma OCR instalado.' }
$output = @{}
foreach ($file in Get-ChildItem -LiteralPath $Directory -Filter '*.png' | Sort-Object Name) {
  $storage = Await-Result ([Windows.Storage.StorageFile]::GetFileFromPathAsync($file.FullName)) ([Windows.Storage.StorageFile])
  $stream = Await-Result ($storage.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  try {
    $decoder = Await-Result ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await-Result ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    try {
      $result = Await-Result ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
      $lines = @()
      foreach ($line in $result.Lines) {
        $rects = @($line.Words | ForEach-Object { $_.BoundingRect })
        if ($rects.Count -eq 0) { continue }
        $x = ($rects.X | Measure-Object -Minimum).Minimum
        $y = ($rects.Y | Measure-Object -Minimum).Minimum
        $right = ($rects | ForEach-Object { $_.X + $_.Width } | Measure-Object -Maximum).Maximum
        $bottom = ($rects | ForEach-Object { $_.Y + $_.Height } | Measure-Object -Maximum).Maximum
        $lines += @{text=$line.Text;x=$x;y=$y;w=$right-$x;h=$bottom-$y}
      }
      $output[$file.Name] = $lines
    } finally { $bitmap.Dispose() }
  } finally { $stream.Dispose() }
}
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
ConvertTo-Json -InputObject $output -Depth 8 -Compress
