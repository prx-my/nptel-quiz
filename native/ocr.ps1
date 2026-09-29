# Windows on-device OCR using the built-in Windows.Media.Ocr (WinRT) engine.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File ocr.ps1 <image> [image ...]
# Emits a JSON array: [{"file":"...","text":"..."}, ...]
#
# Note: uses Windows PowerShell 5.1 (powershell.exe), where WinRT projection is
# available. Requires a Windows language pack with an OCR engine (English is
# normally present on Windows 10/11).

param(
    [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
    [string[]]$Paths
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null

# Load the WinRT types we need.
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]

# Generic AsTask so we can await WinRT IAsyncOperation<T> from PowerShell.
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and
        $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    })[0]

function Await($operation, $resultType) {
    $task = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($operation))
    $task.Wait(-1) | Out-Null
    $task.Result
}

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) {
    try {
        $lang = New-Object Windows.Globalization.Language 'en-US'
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
    }
    catch { }
}
if (-not $engine) {
    Write-Error 'No Windows OCR engine available. Add a language with OCR support in Settings > Time & Language.'
    exit 3
}

$results = @()
foreach ($p in $Paths) {
    try {
        $full = (Resolve-Path -LiteralPath $p).Path
        $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($full)) ([Windows.Storage.StorageFile])
        $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
        $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $ocr = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

        $lines = @()
        foreach ($line in $ocr.Lines) { $lines += $line.Text }

        $results += [pscustomobject]@{ file = $p; text = ($lines -join "`n") }
        $stream.Dispose()
    }
    catch {
        $results += [pscustomobject]@{ file = $p; text = ''; error = "$_" }
    }
}

ConvertTo-Json -InputObject @($results) -Compress -Depth 4
