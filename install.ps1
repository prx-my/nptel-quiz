# nptel-quiz installer (Windows)
#
#   powershell -ExecutionPolicy Bypass -c "iwr -useb https://raw.githubusercontent.com/prx-my/nptel-quiz/main/install.ps1 | iex"
#
# Installs into %USERPROFILE%\.nptel-quiz, installs Playwright's Chromium, and
# links `nptel-quiz` onto your user PATH. OCR uses the built-in Windows.Media.Ocr
# engine, so there is nothing extra to build.

$ErrorActionPreference = 'Stop'

$Repo   = if ($env:NPTEL_QUIZ_REPO) { $env:NPTEL_QUIZ_REPO } else { 'prx-my/nptel-quiz' }
$Ref    = if ($env:NPTEL_QUIZ_REF)  { $env:NPTEL_QUIZ_REF }  else { 'main' }
$AppDir = if ($env:NPTEL_QUIZ_HOME) { $env:NPTEL_QUIZ_HOME } else { Join-Path $env:USERPROFILE '.nptel-quiz' }

function Info($m) { Write-Host "[nptel-quiz] $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "[nptel-quiz] $m" -ForegroundColor Yellow }
function Err($m)  { Write-Host "[nptel-quiz] $m" -ForegroundColor Red }

if (-not $IsWindows -and $env:OS -ne 'Windows_NT') {
    Err 'This installer targets Windows.'
    exit 1
}

# --- Node.js ----------------------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Info 'Installing Node.js LTS via winget...'
        winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    } else {
        Err 'Node.js >= 18 is required. Install it from https://nodejs.org and re-run.'
        exit 1
    }
}
$major = [int](node -p "process.versions.node.split('.')[0]")
if ($major -lt 18) { Err "Node.js >= 18 required (found $(node -v))."; exit 1 }

# --- Fetch source -----------------------------------------------------------
$tmp = Join-Path $env:TEMP ("nptel-quiz-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
$zip = Join-Path $tmp 'src.zip'
$url = "https://codeload.github.com/$Repo/zip/refs/heads/$Ref"
Info "Downloading $Repo@$Ref..."
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
Expand-Archive -Path $zip -DestinationPath $tmp -Force
$srcDir = (Get-ChildItem -Path $tmp -Directory | Where-Object { $_.Name -like 'nptel-quiz-*' } | Select-Object -First 1).FullName

# --- Install files ----------------------------------------------------------
Info "Installing into $AppDir..."
New-Item -ItemType Directory -Path $AppDir -Force | Out-Null
Copy-Item -Path (Join-Path $srcDir '*') -Destination $AppDir -Recurse -Force
Push-Location $AppDir
try {
    Info 'Installing dependencies...'
    npm install --omit=dev --no-audit --no-fund
    Info 'Installing Chromium for Playwright (one-time, ~150MB)...'
    npx --yes playwright install chromium
    Info 'Checking OCR (Windows.Media.Ocr is built in)...'
    node scripts/build-ocr.js
}
finally { Pop-Location }

# --- Shim + PATH ------------------------------------------------------------
$BinDir = Join-Path $AppDir 'bin'
$shim = Join-Path $BinDir 'nptel-quiz.cmd'
@"
@echo off
node "%~dp0nptel-quiz.js" %*
"@ | Set-Content -Path $shim -Encoding ASCII

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*$BinDir*") {
    [Environment]::SetEnvironmentVariable('Path', "$userPath;$BinDir", 'User')
    Warn "Added $BinDir to your user PATH. Restart your terminal for it to take effect."
}
$env:Path = "$env:Path;$BinDir"
Info "Linked: $shim"

# --- Verify -----------------------------------------------------------------
Info 'Verifying...'
node (Join-Path $BinDir 'nptel-quiz.js') doctor

Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'Done. Next steps:' -ForegroundColor Green
Write-Host '  1) nptel-quiz login                       # sign in once (Google SSO)'
Write-Host '  2) nptel-quiz list --course noc26_cs153   # pick a week'
Write-Host '  3) nptel-quiz ocr --url "<quiz url>"      # agent mode, or:'
Write-Host '     $env:GEMINI_API_KEY="..."; nptel-quiz run --url "<quiz url>"'
Write-Host ''
