<#
  check-printer-media.ps1
  -----------------------
  Watches how much media is left on the DNP DS-RX1 roll and sends ONE email
  when it drops below a threshold, so you can swap the roll before it runs out.

  How the "remaining count" is read (in priority order):
    1. DNP PrinterInfo  - if PRINTERINFO_PATH is set in .env.local, this script
       runs it and parses the "prints remaining" number. (Preferred - a true
       direct query of the DS-RX1.)
    2. Simulated value  - if CARDIFYBOOTH_SIMULATED_REMAINING is set, that number
       is used instead. This exists ONLY so the email/threshold/de-dup logic can
       be tested before PrinterInfo is installed. Remove it once PrinterInfo works.

  De-duplication: it emails once when the roll first crosses BELOW the threshold,
  then stays quiet until a new roll is detected (remaining jumps back up), so you
  are not spammed every poll.

  Config is read from .env.local (KEY=VALUE lines). Required for email:
    SMTP_USER            e.g. postmeridian07@gmail.com
    SMTP_APP_PASSWORD    16-char Google App Password (NOT your normal password)
    ALERT_EMAIL_TO       where the low-roll alert is sent
  Optional:
    SMTP_SERVER          default smtp.gmail.com
    SMTP_PORT            default 587
    CARDIFYBOOTH_LOW_THRESHOLD   default 50   (email when remaining < this)
    CARDIFYBOOTH_ROLL_CAPACITY   default 700  (full 4x6 roll; used for logging)
    PRINTERINFO_PATH             full path to DNP PrinterInfo.exe (once installed)

  Test without sending a real email:   -DryRun
  Force a specific count for testing:   -SimulateRemaining 40
#>

param(
  [switch]$DryRun,
  [switch]$TestEmail,
  [string]$TestEmailTo = "",
  [int]$SimulateRemaining = -1
)

$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $PSScriptRoot
$envFile    = Join-Path $projectDir ".env.local"
$stateDir   = Join-Path $projectDir ".booth-storage"
$stateFile  = Join-Path $stateDir "printer-alert-state.json"
$logFile    = Join-Path $stateDir "printer-alert.log"

function Write-Log($msg) {
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Write-Host $line
  try {
    if (-not (Test-Path $stateDir)) { New-Item -ItemType Directory -Path $stateDir -Force | Out-Null }
    Add-Content -Path $logFile -Value $line
  } catch { }
}

# --- Load .env.local into a hashtable ---------------------------------------
function Read-DotEnv($path) {
  $map = @{}
  if (-not (Test-Path $path)) { return $map }
  foreach ($raw in Get-Content -LiteralPath $path) {
    $line = $raw.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith("#")) { continue }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { continue }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    if ($val.Length -ge 2 -and (($val[0] -eq '"' -and $val[-1] -eq '"') -or ($val[0] -eq "'" -and $val[-1] -eq "'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $map[$key] = $val
  }
  return $map
}

$cfg = Read-DotEnv $envFile
function Cfg($key, $default) { if ($cfg.ContainsKey($key) -and $cfg[$key].Trim().Length -gt 0) { return $cfg[$key].Trim() } return $default }

$threshold    = [int](Cfg "CARDIFYBOOTH_LOW_THRESHOLD" "50")
$rollCapacity = [int](Cfg "CARDIFYBOOTH_ROLL_CAPACITY" "700")
$dnpDir       = Cfg "CARDIFYBOOTH_DNP_DIR" "C:\DNPPIA\PrinterInfo"

# ============================================================================
#  Get-RemainingPrints
#  Reads the DS-RX1 roll silently via scripts/read-printer-dll.ps1 (cspstat.dll).
#  Returns an int (prints remaining), or $null when the printer is busy printing
#  (so the caller should skip this cycle without alerting).
#  Test overrides: -SimulateRemaining <n> or CARDIFYBOOTH_SIMULATED_REMAINING.
# ============================================================================
function Get-RemainingPrints {
  if ($SimulateRemaining -ge 0) {
    Write-Log "Using -SimulateRemaining override: $SimulateRemaining"
    return $SimulateRemaining
  }

  $sim = Cfg "CARDIFYBOOTH_SIMULATED_REMAINING" ""
  if ($sim -ne "") {
    Write-Log "Using CARDIFYBOOTH_SIMULATED_REMAINING from .env.local: $sim"
    return [int]$sim
  }

  $reader = Join-Path $PSScriptRoot "read-printer-dll.ps1"
  if (-not (Test-Path $reader)) { throw "Reader not found: $reader" }

  $raw = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $reader -InstallDir $dnpDir 2>&1
  $line = @($raw | Where-Object { $_ -match '^\s*\{' }) | Select-Object -Last 1
  if (-not $line) { throw "Printer reader returned no JSON. Output: $raw" }

  $obj = $line | ConvertFrom-Json
  if ($obj.busy) { Write-Log "Printer is busy printing - skipping this cycle."; return $null }
  if (-not $obj.ok) { throw "Printer read failed: $($obj.error)" }

  Write-Log ("Read from printer: remaining={0} capacity={1} status={2}" -f $obj.remaining, $obj.capacity, $obj.statusRaw)
  return [int]$obj.remaining
}

# --- State (for once-per-roll de-dup) ---------------------------------------
function Read-State {
  if (Test-Path $stateFile) {
    try { return Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json } catch { }
  }
  return [pscustomobject]@{ alertSent = $false; lastRemaining = $null }
}
function Write-State($state) {
  if (-not (Test-Path $stateDir)) { New-Item -ItemType Directory -Path $stateDir -Force | Out-Null }
  $state | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
}

# --- Email ------------------------------------------------------------------
function Send-LowRollEmail($remaining) {
  $smtpUser = Cfg "SMTP_USER" ""
  $smtpPass = (Cfg "SMTP_APP_PASSWORD" "") -replace '\s', ''
  $to       = Cfg "ALERT_EMAIL_TO" $smtpUser
  $server   = Cfg "SMTP_SERVER" "smtp.gmail.com"
  $port     = [int](Cfg "SMTP_PORT" "587")

  $subject = "CardifyBooth: printer roll low ($remaining prints left)"
  $body    = @"
The DNP DS-RX1 photo roll is running low.

  Prints remaining : $remaining
  Alert threshold  : $threshold
  Full roll size   : $rollCapacity

Load a fresh roll soon. This is an automated message from the booth PC.
"@

  if ($DryRun) {
    $to2 = if ($to -ne "") { $to } else { "<ALERT_EMAIL_TO not set>" }
    Write-Log "[DryRun] Would email '$to2' via ${server}:$port -> subject: $subject"
    return
  }

  if ($smtpUser -eq "" -or $smtpPass -eq "" -or $to -eq "") {
    throw "Email not configured. Set SMTP_USER, SMTP_APP_PASSWORD and ALERT_EMAIL_TO in .env.local."
  }

  $secure = ConvertTo-SecureString $smtpPass -AsPlainText -Force
  $cred   = New-Object System.Management.Automation.PSCredential ($smtpUser, $secure)
  Send-MailMessage -From $smtpUser -To $to -Subject $subject -Body $body `
    -SmtpServer $server -Port $port -UseSsl -Credential $cred
  Write-Log "Low-roll email sent to $to (remaining=$remaining)."
}

function Send-PrinterTestEmail($remaining) {
  $smtpUser = Cfg "SMTP_USER" ""
  $smtpPass = (Cfg "SMTP_APP_PASSWORD" "") -replace '\s', ''
  $to       = if ($TestEmailTo.Trim().Length -gt 0) { $TestEmailTo.Trim() } else { Cfg "ALERT_EMAIL_TO" $smtpUser }
  $server   = Cfg "SMTP_SERVER" "smtp.gmail.com"
  $port     = [int](Cfg "SMTP_PORT" "587")

  if ($smtpUser -eq "" -or $smtpPass -eq "" -or $to -eq "") {
    throw "Email not configured. Set SMTP_USER, SMTP_APP_PASSWORD and ALERT_EMAIL_TO in .env.local."
  }

  $subject = "CardifyBooth TEST: printer connection OK ($remaining prints remaining)"
  $body = @"
This is a test of the CardifyBooth printer email monitor.

PrinterInfo was read successfully.
Current prints remaining: $remaining
Configured low-roll threshold: $threshold
Full roll capacity: $rollCapacity

This test does not change the low-roll alert state.
"@

  $secure = ConvertTo-SecureString $smtpPass -AsPlainText -Force
  $cred   = New-Object System.Management.Automation.PSCredential ($smtpUser, $secure)
  Send-MailMessage -From $smtpUser -To $to -Subject $subject -Body $body `
    -SmtpServer $server -Port $port -UseSsl -Credential $cred
  Write-Log "Printer test email sent to $to (real remaining=$remaining)."
}

# --- Main -------------------------------------------------------------------
try {
  $remaining = Get-RemainingPrints
  if ($null -eq $remaining) { exit 0 }  # printer busy; try again next cycle

  if ($TestEmail) {
    Send-PrinterTestEmail $remaining
    exit 0
  }

  $state = Read-State
  Write-Log ("Remaining={0}  Threshold={1}  alertSent={2}" -f $remaining, $threshold, $state.alertSent)

  # New roll detected (count jumped back up well above threshold) -> re-arm.
  if ($state.alertSent -and $remaining -gt $threshold) {
    Write-Log "Remaining rose above threshold - assuming new roll. Re-arming alert."
    $state.alertSent = $false
  }

  if ($remaining -lt $threshold -and -not $state.alertSent) {
    Send-LowRollEmail $remaining
    $state.alertSent = $true
  } elseif ($remaining -lt $threshold) {
    Write-Log "Below threshold but alert already sent for this roll - staying quiet."
  } else {
    Write-Log "Above threshold - no action."
  }

  $state.lastRemaining = $remaining
  Write-State $state
}
catch {
  Write-Log "ERROR: $($_.Exception.Message)"
  exit 1
}
