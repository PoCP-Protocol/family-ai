[CmdletBinding()]
param(
    [switch]$Once,
    [int]$IntervalSeconds = 30,
    [int]$FailureThreshold = 2,
    [switch]$NoElevation
)

$ErrorActionPreference = 'SilentlyContinue'
$OutlineExe = 'C:\Program Files (x86)\Outline\Outline.exe'
$TapName = 'outline-tap0'
$LogPath = Join-Path $env:LOCALAPPDATA 'Outline\watchdog.log'
$ProbeUrl = 'http://1.1.1.1/cdn-cgi/trace'

function Write-Log {
    param([string]$Message)
    $line = "{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    $dir = Split-Path $LogPath
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Add-Content -Path $LogPath -Value $line -Encoding UTF8
    Write-Host $line
}

function Ensure-Administrator {
    if ($NoElevation) { return }
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
        if ($Once) { $args += '-Once' }
        if ($IntervalSeconds -ne 30) { $args += @('-IntervalSeconds', $IntervalSeconds) }
        if ($FailureThreshold -ne 2) { $args += @('-FailureThreshold', $FailureThreshold) }
        Start-Process pwsh -Verb RunAs -ArgumentList $args
        exit 0
    }
}

function Test-OutlineHealth {
    $outline = @(Get-Process Outline)
    $tun = @(Get-Process tun2socks)
    $tap = Get-NetAdapter -Name $TapName
    $routes = @(Get-NetRoute | Where-Object { $_.DestinationPrefix -in @('0.0.0.0/1', '128.0.0.0/1') -and $_.InterfaceAlias -eq $TapName })
    $probeOk = $false
    try {
        $probe = & curl.exe --noproxy '*' --connect-timeout 5 --max-time 8 --silent --show-error $ProbeUrl 2>$null
        $probeOk = ($LASTEXITCODE -eq 0 -and $probe -match '(^|\r?\n)ip=')
    } catch {}

    [pscustomobject]@{
        Healthy = ($outline.Count -gt 0 -and $tun.Count -gt 0 -and $tap.Status -eq 'Up' -and $routes.Count -eq 2)
        Outline = $outline.Count
        Tun2Socks = $tun.Count
        TapStatus = [string]$tap.Status
        RouteCount = $routes.Count
        Probe = $probeOk
    }
}

function Remove-StaleRoutes {
    foreach ($prefix in @('0.0.0.0/1', '128.0.0.0/1')) {
        Get-NetRoute -DestinationPrefix $prefix -ErrorAction SilentlyContinue |
            Where-Object InterfaceAlias -eq $TapName |
            Remove-NetRoute -Confirm:$false -ErrorAction SilentlyContinue
        & route.exe delete ($prefix -replace '/1', '') mask 128.0.0.0 | Out-Null
    }
}

function Repair-Outline {
    Write-Log 'repair start'
    Get-Process tun2socks -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process Outline -ErrorAction SilentlyContinue | Stop-Process -Force
    Remove-StaleRoutes
    Get-Service OutlineService -ErrorAction SilentlyContinue | Where-Object Status -ne 'Running' | Start-Service
    if (-not (Test-Path $OutlineExe)) {
        Write-Log "repair failed: executable not found at $OutlineExe"
        return
    }
    Start-Process $OutlineExe
    Write-Log 'repair restart requested'
}

Ensure-Administrator
$failures = 0
Write-Log "watchdog started; interval=${IntervalSeconds}s threshold=$FailureThreshold"

do {
    $health = Test-OutlineHealth
    Write-Log ("health healthy={0} outline={1} tun2socks={2} tap={3} routes={4} probe={5}" -f $health.Healthy, $health.Outline, $health.Tun2Socks, $health.TapStatus, $health.RouteCount, $health.Probe)
    if ($health.Healthy) {
        $failures = 0
    } else {
        $failures++
        if ($failures -ge $FailureThreshold) {
            Repair-Outline
            $failures = 0
        }
    }
    if (-not $Once) { Start-Sleep -Seconds $IntervalSeconds }
} while (-not $Once)

Write-Log 'watchdog stopped'
