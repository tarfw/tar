# Edge Complete Uninstall & Cleanup Script
# Run as Administrator for best results

Write-Host "=== Microsoft Edge Complete Removal ===" -ForegroundColor Yellow
Write-Host ""

# 1. Kill all Edge processes
Write-Host "[1/6] Killing Edge processes..." -ForegroundColor Cyan
Get-Process -Name msedge -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name MicrosoftEdge -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name MicrosoftEdgeUpdate -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  Done" -ForegroundColor Green

# 2. Stop Edge services
Write-Host "[2/6] Stopping Edge services..." -ForegroundColor Cyan
$services = @("edgeupdate", "edgeupdatem", "MicrosoftEdgeElevationService")
foreach ($svc in $services) {
    Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue
    Set-Service -Name $svc -StartupType Disabled -ErrorAction SilentlyContinue
    Write-Host "  Stopped/disabled: $svc" -ForegroundColor Green
}

# 3. Remove installation folders
Write-Host "[3/6] Removing installation folders..." -ForegroundColor Cyan
$installPaths = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge",
    "${env:ProgramFiles(x86)}\Microsoft\EdgeCore",
    "${env:ProgramFiles(x86)}\Microsoft\EdgeUpdate",
    "${env:ProgramFiles}\Microsoft\Edge",
    "${env:ProgramFiles}\Microsoft\EdgeCore",
    "${env:ProgramFiles}\Microsoft\EdgeUpdate",
    "${env:ProgramData}\Microsoft\Edge",
    "${env:ProgramData}\Microsoft\EdgeUpdate"
)

foreach ($path in $installPaths) {
    if (Test-Path $path) {
        # Try takeown for locked files
        $folderCount = (Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object).Count
        Write-Host "  Removing: $path ($folderCount items)" -ForegroundColor Gray
        
        cmd /c "takeown /F `"$path`" /R /D Y" 2>$null | Out-Null
        cmd /c "icacls `"$path`" /grant Administrators:F /T /Q" 2>$null | Out-Null
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        
        if (-not (Test-Path $path)) {
            Write-Host "    REMOVED" -ForegroundColor Green
        } else {
            Write-Host "    PARTIAL (reboot will clean remaining)" -ForegroundColor Yellow
        }
    }
}

# 4. Remove user data and cache
Write-Host "[4/6] Removing user data, cache, and temp files..." -ForegroundColor Cyan
$userPaths = @(
    "$env:LOCALAPPDATA\Microsoft\Edge",
    "$env:APPDATA\Microsoft\Edge",
    "$env:APPDATA\Microsoft\EdgeUpdate",
    "$env:LOCALAPPDATA\Microsoft\EdgeUpdate",
    "$env:LOCALAPPDATA\Temp\Microsoft.Edge*",
    "$env:LOCALAPPDATA\Temp\msedge*",
    "$env:LOCALAPPDATA\Temp\edge*",
    "$env:LOCALAPPDATA\Microsoft\Windows\INetCache\Edge",
    "$env:LOCALAPPDATA\Packages\MicrosoftEdge_*"
)

foreach ($path in $userPaths) {
    if ($path -like '*\*') {
        # Wildcard paths
        $items = Get-ChildItem -Path $path -ErrorAction SilentlyContinue
        foreach ($item in $items) {
            Remove-Item -Path $item.FullName -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "  REMOVED: $($item.FullName)" -ForegroundColor Green
        }
    } elseif (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        if (-not (Test-Path $path)) {
            Write-Host "  REMOVED: $path" -ForegroundColor Green
        }
    }
}

# Clean additional temp locations
$tempFolders = Get-ChildItem "$env:TEMP" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'edge|msedge|MicrosoftEdge' }
foreach ($tf in $tempFolders) {
    Remove-Item -Path $tf.FullName -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  REMOVED temp: $($tf.FullName)" -ForegroundColor Green
}

# 5. Clean registry
Write-Host "[5/6] Cleaning registry entries..." -ForegroundColor Cyan
$regPaths = @(
    "HKCU:\SOFTWARE\Microsoft\Edge",
    "HKCU:\SOFTWARE\Microsoft\EdgeUpdate",
    "HKCU:\SOFTWARE\Microsoft\EdgeUpdateClient",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run\MicrosoftEdge",
    "HKLM:\SOFTWARE\Microsoft\Edge",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Edge",
    "HKLM:\SOFTWARE\Microsoft\EdgeUpdate",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Microsoft Edge",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Microsoft Edge Update",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Microsoft Edge",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Microsoft Edge Update"
)

foreach ($reg in $regPaths) {
    if (Test-Path $reg) {
        Remove-Item -Path $reg -Recurse -Force -ErrorAction SilentlyContinue
        if (-not (Test-Path $reg)) {
            Write-Host "  REMOVED: $reg" -ForegroundColor Green
        } else {
            Write-Host "  FAILED (access denied): $reg" -ForegroundColor Yellow
        }
    }
}

# Remove Edge scheduled tasks
$tasks = Get-ScheduledTask -TaskName *Edge* -ErrorAction SilentlyContinue
foreach ($task in $tasks) {
    Unregister-ScheduledTask -TaskName $task.TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "  REMOVED task: $($task.TaskName)" -ForegroundColor Green
}

# 6. Verify
Write-Host "[6/6] Verification..." -ForegroundColor Cyan
Write-Host ""
Write-Host "=== Removal Summary ===" -ForegroundColor Yellow

$remaining = 0
foreach ($path in $installPaths) {
    if (Test-Path $path) {
        Write-Host "  STILL EXISTS: $path" -ForegroundColor Red
        $remaining++
    }
}

$edgeProcs = Get-Process -Name msedge -ErrorAction SilentlyContinue
if ($edgeProcs) {
    Write-Host "  RUNNING PROCESSES: $($edgeProcs.Count) Edge processes" -ForegroundColor Red
    $remaining++
}

if ($remaining -eq 0) {
    Write-Host "  ALL CLEAN - Microsoft Edge has been fully removed!" -ForegroundColor Green
} else {
    Write-Host "  Some items remain (will be cleaned on next reboot)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Cleanup Complete ===" -ForegroundColor Yellow
Write-Host "RECOMMENDATION: Restart your PC to fully remove locked files." -ForegroundColor Cyan
