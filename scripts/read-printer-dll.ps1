<#
  read-printer-dll.ps1
  --------------------
  SILENT read of the DNP DS-RX1 roll status by calling DNP's cspstat.dll
  directly (the same library PrinterInfo.exe uses) - NO window is ever shown.

  Prints ONE line of JSON, e.g.:
    {"ok":true,"remaining":648,"capacity":700,"rawCounter":698,"offset":50,"statusRaw":"0x00010001","printers":1}

  How it works (verified against PrinterInfo, which shows Media Remaining = 648):
    remaining = GetMediaCounter(port) - GetMediaCountOffset(port)      (698 - 50)
    capacity  = GetInitialMediaCount(port) - GetMediaCountOffset(port) (750 - 50)

  Safety:
    * cspstat.dll is 32-bit, so this script re-launches itself under 32-bit
      PowerShell (SysWOW64) automatically when started from a 64-bit host.
    * It only binds READ-ONLY Get* functions - never Print/Set/Firmware calls.
    * It skips the read while a print job is active (DNP warns the status
      channel must not be used while printing) and returns {"ok":false,"busy":true}.
    * It avoids GetMediaCounterH / GetCounterL etc. - some of those block.

  Params:
    -InstallDir   Folder containing cspstat.dll (default C:\DNPPIA\PrinterInfo)
    -QueueNames   Print queues checked for active jobs (default DS-RX1, DS-RX1-Strips)
#>

param(
  [string]$InstallDir  = "C:\DNPPIA\PrinterInfo",
  [string[]]$QueueNames = @("DS-RX1", "DS-RX1-Strips")
)

$ErrorActionPreference = "Stop"
function Emit($o) { $o | ConvertTo-Json -Compress }

# --- Re-launch under 32-bit PowerShell if we are 64-bit --------------------
if ([Environment]::Is64BitProcess) {
  $ps32 = Join-Path $env:WINDIR "SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
  if (-not (Test-Path $ps32)) { Emit @{ ok = $false; error = "32-bit PowerShell not found at $ps32" }; exit 1 }
  & $ps32 -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath @PSBoundParameters
  exit $LASTEXITCODE
}

# --- Never query while printing --------------------------------------------
foreach ($q in $QueueNames) {
  try {
    $jobs = @(Get-PrintJob -PrinterName $q -ErrorAction SilentlyContinue)
    if ($jobs.Count -gt 0) { Emit @{ ok = $false; busy = $true; reason = "print job active on $q" }; exit 0 }
  } catch { }
}

$dll = Join-Path $InstallDir "cspstat.dll"
if (-not (Test-Path $dll)) { Emit @{ ok = $false; error = "cspstat.dll not found in $InstallDir (install DNP PrinterInfo)" }; exit 1 }

# cspstat.dll and its dependencies must resolve from the install dir.
[Environment]::CurrentDirectory = $InstallDir
$env:PATH = "$InstallDir;$env:PATH"

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class CspStat {
  [DllImport("cspstat.dll", CallingConvention=CallingConvention.StdCall)] public static extern int GetPrinterPortNum(byte[] pArray, int arraysize);
  [DllImport("cspstat.dll", CallingConvention=CallingConvention.StdCall)] public static extern int GetMediaCounter(int portno);
  [DllImport("cspstat.dll", CallingConvention=CallingConvention.StdCall)] public static extern int GetMediaCountOffset(int portno);
  [DllImport("cspstat.dll", CallingConvention=CallingConvention.StdCall)] public static extern int GetInitialMediaCount(int portno);
  [DllImport("cspstat.dll", EntryPoint="GetStatus", CallingConvention=CallingConvention.StdCall)] public static extern uint GetStatus(int portno);
}
"@

try {
  # Init / enumerate. This call opens the port; the Get* reads return -1 without it.
  $buf = New-Object byte[] 128
  $printers = [CspStat]::GetPrinterPortNum($buf, 128)
  if ($printers -lt 1) { Emit @{ ok = $false; error = "No DNP printer detected by cspstat.dll" }; exit 1 }

  $port      = 0   # single printer -> port index 0
  $rawCounter = [CspStat]::GetMediaCounter($port)
  $offset     = [CspStat]::GetMediaCountOffset($port)
  $rawInitial = [CspStat]::GetInitialMediaCount($port)
  $status     = [CspStat]::GetStatus($port)

  if ($rawCounter -lt 0 -or $offset -lt 0) {
    Emit @{ ok = $false; error = "cspstat read failed (counter=$rawCounter offset=$offset)"; statusRaw = ("0x{0:X8}" -f $status) }; exit 1
  }

  $remaining = $rawCounter - $offset
  $capacity  = if ($rawInitial -ge 0) { $rawInitial - $offset } else { $null }

  Emit @{
    ok         = $true
    remaining  = $remaining
    capacity   = $capacity
    rawCounter = $rawCounter
    offset     = $offset
    statusRaw  = ("0x{0:X8}" -f $status)
    printers   = $printers
  }
}
catch {
  Emit @{ ok = $false; error = $_.Exception.Message }
  exit 1
}
