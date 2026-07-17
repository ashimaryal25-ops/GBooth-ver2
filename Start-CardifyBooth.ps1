<#
  Start-CardifyBooth.ps1
  ----------------------
  One-click kiosk launcher.

  What it does, in order:
    1. Makes sure the booth web server is running on http://localhost:<Port>
       (builds it once if there is no production build, then starts it).
    2. Detects the connected displays.
    3. Opens the KIOSK booth UI fullscreen on the PRIMARY display.
    4. Opens the CAMERA MIRROR fullscreen on the SECOND display (the live cam
       the guest sees). Skipped automatically if only one display is connected.

  Double-click "Start-CardifyBooth.bat" to run this. If a booth window or the
  mirror ends up on the wrong monitor, run with  -SwapMonitors.

  Handy switches:
    -SwapMonitors   Put the booth on the second display and the mirror on the primary.
    -Dev            Use "npm run dev" instead of a production build (for testing).
    -Port <n>       Server port (default 3000).
#>

param(
  [int]$Port = 3000,
  [switch]$SwapMonitors,
  [switch]$Dev
)

$ErrorActionPreference = "Stop"
$projectDir = $PSScriptRoot
$kioskUrl  = "http://localhost:$Port/"
$mirrorUrl = "http://localhost:$Port/camera-mirror.html"
# Health check MUST use 127.0.0.1, not localhost. The server binds IPv4-only
# (-H 0.0.0.0), but Windows resolves "localhost" to ::1 (IPv6) first, so an
# Invoke-WebRequest to localhost hangs until it times out - which made the
# launcher sit at "Waiting for the server to come up..." forever even though the
# server was up. Chrome is unaffected (it falls back to IPv4 on its own), so the
# browser URLs stay on localhost (which also keeps the camera-permission origin
# consistent).
$healthUrl = "http://127.0.0.1:$Port/"

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

# --- 1. Locate Chrome -------------------------------------------------------
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
  Write-Host "Google Chrome was not found. Install Chrome, then run this again." -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}

# --- 2. Make sure the server is up -----------------------------------------
function Test-Server {
  try { return (Invoke-WebRequest $healthUrl -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 }
  catch { return $false }
}

# Rebuild if there is no build OR the build is older than the source, so a
# stale build never silently serves old UI after the code changed.
function Test-NeedsBuild {
  $buildId = Join-Path $projectDir ".next\BUILD_ID"
  if (-not (Test-Path $buildId)) { return $true }
  $buildTime = (Get-Item $buildId).LastWriteTime
  $newest    = $null
  foreach ($dir in "src", "public") {
    $full = Join-Path $projectDir $dir
    if (Test-Path $full) {
      $f = Get-ChildItem $full -Recurse -File -ErrorAction SilentlyContinue |
           Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($f -and (-not $newest -or $f.LastWriteTime -gt $newest)) { $newest = $f.LastWriteTime }
    }
  }
  foreach ($cfg in "package.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs") {
    $cf = Join-Path $projectDir $cfg
    if (Test-Path $cf) {
      $t = (Get-Item $cf).LastWriteTime
      if (-not $newest -or $t -gt $newest) { $newest = $t }
    }
  }
  return ($newest -and $newest -gt $buildTime)
}

$needsBuild = if ($Dev) { $false } else { Test-NeedsBuild }

if ((Test-Server) -and -not $needsBuild -and -not $Dev) {
  Write-Step "Booth server already running on port $Port and up to date."
} else {
  # Kill whatever is holding the port (a stale server from an old build or an
  # abandoned dev server) so the booth never serves outdated UI.
  $stale = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($stale) {
    Write-Step "Stopping the old server on port $Port so the latest build is served..."
    $stale | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
      try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {}
    }
    Start-Sleep -Seconds 1
  }

  Push-Location $projectDir
  try {
    if ($Dev) {
      Write-Step "Starting DEV server (npm run dev)..."
      Start-Process "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $projectDir -WindowStyle Minimized
    } else {
      if ($needsBuild) {
        Write-Step "Building the latest UI (this can take a minute)..."
        npm run build
      }

      Write-Step "Starting production server (npm run start)..."
      Start-Process "cmd.exe" -ArgumentList "/c npm run start -- -H 0.0.0.0 -p $Port" -WorkingDirectory $projectDir -WindowStyle Minimized
    }
  } finally { Pop-Location }

  Write-Step "Waiting for the server to come up..."
  $ready = $false
  for ($i = 0; $i -lt 90; $i++) {
    if (Test-Server) { $ready = $true; break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) {
    Write-Host "Server did not respond on $kioskUrl. Check the minimized server window for errors." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
  }
  Write-Step "Server is up."
}

# --- 3. Detect displays -----------------------------------------------------
Add-Type -AssemblyName System.Windows.Forms
$screens   = [System.Windows.Forms.Screen]::AllScreens
$primary   = [System.Windows.Forms.Screen]::PrimaryScreen
$secondary = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1

# Decide which display shows which page.
$boothScreen  = $primary
$mirrorScreen = $secondary
if ($SwapMonitors -and $secondary) {
  $boothScreen  = $secondary
  $mirrorScreen = $primary
}

# --- 4. Launch the windows --------------------------------------------------
# Persistent profiles keep each screen on the correct display and remember the
# one-time camera permission.
$profileRoot   = Join-Path $env:LocalAppData "CardifyBooth"
$boothProfile  = Join-Path $profileRoot "booth-profile"
$mirrorProfile = Join-Path $profileRoot "mirror-profile"

$commonFlags = @(
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-infobars",
  "--disable-translate",
  "--disable-session-crashed-bubble",
  "--disable-pinch",
  "--overscroll-history-navigation=0",
  "--autoplay-policy=no-user-gesture-required"
)

# Pre-grant camera permission for the booth origin in each Chrome profile. This
# avoids both a permission prompt and a browser warning strip on the mirror.
function ConvertTo-HashtableDeep($obj) {
  if ($null -eq $obj) { return $null }
  if ($obj -is [System.Management.Automation.PSCustomObject]) {
    $h = @{}; foreach ($p in $obj.PSObject.Properties) { $h[$p.Name] = ConvertTo-HashtableDeep $p.Value }; return $h
  }
  if ($obj -is [System.Collections.IDictionary]) {
    $h = @{}; foreach ($k in $obj.Keys) { $h[$k] = ConvertTo-HashtableDeep $obj[$k] }; return $h
  }
  if ($obj -is [object[]]) { return @($obj | ForEach-Object { ConvertTo-HashtableDeep $_ }) }
  return $obj
}

function Grant-CameraPermission($profile, $origin) {
  $prefDir  = Join-Path $profile "Default"
  New-Item -ItemType Directory -Force -Path $prefDir | Out-Null
  $prefFile = Join-Path $prefDir "Preferences"

  $prefs = @{}
  if (Test-Path $prefFile) {
    # Read as UTF-8 explicitly (PS 5.1 Get-Content -Raw defaults to ANSI and
    # would corrupt any multi-byte characters on the round-trip).
    try { $prefs = ConvertTo-HashtableDeep ([System.IO.File]::ReadAllText($prefFile) | ConvertFrom-Json) } catch { $prefs = @{} }
    if ($null -eq $prefs) { $prefs = @{} }
  }
  if (-not $prefs.ContainsKey('profile')) { $prefs['profile'] = @{} }
  if (-not $prefs['profile'].ContainsKey('content_settings')) { $prefs['profile']['content_settings'] = @{} }
  if (-not $prefs['profile']['content_settings'].ContainsKey('exceptions')) { $prefs['profile']['content_settings']['exceptions'] = @{} }
  $exc = $prefs['profile']['content_settings']['exceptions']
  $key = "$origin,*"
  foreach ($perm in 'media_stream_camera', 'media_stream_mic') {
    if (-not $exc.ContainsKey($perm)) { $exc[$perm] = @{} }
    $exc[$perm][$key] = @{ setting = 1 }   # 1 = Allow
  }
  $json = $prefs | ConvertTo-Json -Depth 100 -Compress
  [System.IO.File]::WriteAllText($prefFile, $json)   # UTF-8, no BOM
}

# $FullscreenMode:
#   "kiosk"      -> Chrome --kiosk. Fully locked down (no way to exit/open tabs).
#                   Best for the BOOTH (the touch screen guests interact with),
#                   but it tends to IGNORE --window-position and land on the
#                   primary display.
#   "fullscreen" -> Chrome --start-fullscreen. Honors --window-position, so it
#                   reliably opens fullscreen on a SPECIFIC monitor. Best for the
#                   MIRROR (a no-input HDMI screen that must land on the right
#                   display with zero interaction).
function Start-KioskWindow($screen, $profile, $url, $FullscreenMode) {
  $b = $screen.Bounds
  $modeFlag = if ($FullscreenMode -eq "kiosk") { "--kiosk" } else { "--start-fullscreen" }
  $args = @($modeFlag) + $commonFlags + @(
    "--user-data-dir=$profile",
    "--window-position=$($b.X),$($b.Y)",
    "--window-size=$($b.Width),$($b.Height)",
    $url
  )
  Start-Process $chrome -ArgumentList $args
}

# Seed camera/mic permission into both profiles before launching.
$origin = "http://localhost:$Port"
Grant-CameraPermission $boothProfile  $origin
Grant-CameraPermission $mirrorProfile $origin

Write-Step "Opening booth UI on $($boothScreen.DeviceName)..."
Start-KioskWindow $boothScreen $boothProfile $kioskUrl "kiosk"

if ($mirrorScreen) {
  Start-Sleep -Milliseconds 800
  Write-Step "Opening camera mirror on $($mirrorScreen.DeviceName)..."
  # Positioned --start-fullscreen so the mirror reliably lands fullscreen on the
  # second (no-input) display without any mouse/touch.
  Start-KioskWindow $mirrorScreen $mirrorProfile $mirrorUrl "fullscreen"
} else {
  Write-Host "Only one display detected - camera mirror was not opened." -ForegroundColor Yellow
}

Write-Step "CardifyBooth is running. To quit a kiosk window press  Alt+F4  (or Ctrl+W)."
