# Prevent Windows from Auto-Reinstalling Microsoft Edge
# Group Policy Registry Tweaks
# Run as Administrator

$ErrorActionPreference = "SilentlyContinue"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  BLOCK EDGE AUTO-INSTALL (Group Policy)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# 1. Disable Edge Update Service
# ============================================
Write-Host "[1/4] Disabling Edge Update Services..." -ForegroundColor Cyan

$services = @("edgeupdate", "edgeupdatem", "MicrosoftEdgeElevationService")
foreach ($svc in $services) {
    Stop-Service -Name $svc -Force -ErrorAction SilentlyContinue
    Set-Service -Name $svc -StartupType Disabled -ErrorAction SilentlyContinue
    Write-Host "  [OK] Disabled service: $svc" -ForegroundColor Green
}

# ============================================
# 2. Block Edge Install via EdgeUpdate Registry
# ============================================
Write-Host "[2/4] Setting EdgeUpdate block registry keys..." -ForegroundColor Cyan

# EdgeUpdate path
$euPath = "HKLM:\SOFTWARE\Microsoft\EdgeUpdate"
if (-not (Test-Path $euPath)) { New-Item -Path $euPath -Force | Out-Null }

# Prevent updating to Edge with Chromium
Set-ItemProperty -Path $euPath -Name "DoNotUpdateToEdgeWithChromium" -Value 1 -Type DWord -Force
Write-Host "  [OK] DoNotUpdateToEdgeWithChromium = 1" -ForegroundColor Green

# ============================================
# 3. Group Policy: Prevent Edge Installation
# ============================================
Write-Host "[3/4] Applying Group Policy to prevent Edge install..." -ForegroundColor Cyan

# Create the Policies path
$gpPath = "HKLM:\SOFTWARE\Policies\Microsoft\EdgeUpdate"
if (-not (Test-Path $gpPath)) { New-Item -Path $gpPath -Force | Out-Null }

# Edge Stable product GUID
$edgeStableGUID = "{56EB18F8-B008-4CBD-B6D2-8C97FE7E9062}"

$policyKeys = @(
    @{ Name = "UpdateDefault";           Value = 0; Desc = "Disable default auto-update" },
    @{ Name = "AllowEdgeReinstall";      Value = 0; Desc = "Block Edge reinstallation" },
    @{ Name = "InstallDefault";          Value = 0; Desc = "Block default Edge installation" },
    @{ Name = "Update" + $edgeStableGUID; Value = 0; Desc = "Block Edge Stable updates" },
    @{ Name = "Install" + $edgeStableGUID; Value = 0; Desc = "Block Edge Stable installation" }
)

foreach ($key in $policyKeys) {
    Set-ItemProperty -Path $gpPath -Name $key.Name -Value $key.Value -Type DWord -Force
    Write-Host "  [OK] $($key.Desc): $($key.Name) = $($key.Value)" -ForegroundColor Green
}

# ============================================
# 4. Block Edge from Running Setup/Installer
# ============================================
Write-Host "[4/4] Blocking Edge installer executables..." -ForegroundColor Cyan

# Create a DisallowRun registry key to block Edge setup
$disallowPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer\DisallowRun"
if (-not (Test-Path $disallowPath)) { New-Item -Path $disallowPath -Force | Out-Null }

# Enable DisallowRun
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" -Name "DisallowRun" -Value 1 -Type DWord -Force

# Add Edge executables to disallow list
$disallowExes = @(
    @{ Num = "1"; Exe = "msedge_setup.exe"; Desc = "Edge Setup" },
    @{ Num = "2"; Exe = "MicrosoftEdgeUpdate.exe"; Desc = "Edge Update" },
    @{ Num = "3"; Exe = "msedge_installer.exe"; Desc = "Edge Installer" },
    @{ Num = "4"; Exe = "MicrosoftEdgeSetup.exe"; Desc = "Edge Setup Alt" }
)

# Check existing entries to avoid conflicts
$existing = Get-ItemProperty -Path $disallowPath -ErrorAction SilentlyContinue
$maxNum = 0
if ($existing) {
    $existing.PSObject.Properties | Where-Object { $_.Value -match 'edge' -or $_.Value -match 'Edge' } | ForEach-Object {
        $num = [int]$_.Name
        if ($num -gt $maxNum) { $maxNum = $num }
    }
}

foreach ($exe in $disallowExes) {
    $numStr = $exe.Num
    Set-ItemProperty -Path $disallowPath -Name $numStr -Value $exe.Exe -Type String -Force
    Write-Host "  [OK] Blocked: $($exe.Exe) ($($exe.Desc))" -ForegroundColor Green
}

# ============================================
# VERIFICATION
# ============================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  VERIFICATION" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Check EdgeUpdate key
Write-Host ""
Write-Host "EdgeUpdate Registry:" -ForegroundColor Yellow
$eu = Get-ItemProperty -Path $euPath -ErrorAction SilentlyContinue
if ($eu.DoNotUpdateToEdgeWithChromium -eq 1) {
    Write-Host "  [OK] DoNotUpdateToEdgeWithChromium = 1" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] DoNotUpdateToEdgeWithChromium not set" -ForegroundColor Red
}

# Check Group Policy keys
Write-Host ""
Write-Host "Group Policy Keys:" -ForegroundColor Yellow
$gp = Get-ItemProperty -Path $gpPath -ErrorAction SilentlyContinue
foreach ($key in $policyKeys) {
    $val = $gp.$($key.Name)
    if ($val -eq 0) {
        Write-Host "  [OK] $($key.Name) = 0" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] $($key.Name) = $val (expected 0)" -ForegroundColor Yellow
    }
}

# Check DisallowRun
Write-Host ""
Write-Host "DisallowRun:" -ForegroundColor Yellow
$dr = Get-ItemProperty -Path $disallowPath -ErrorAction SilentlyContinue
$drEnabled = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" -Name "DisallowRun" -ErrorAction SilentlyContinue
if ($drEnabled.DisallowRun -eq 1) {
    Write-Host "  [OK] DisallowRun is enabled" -ForegroundColor Green
    foreach ($exe in $disallowExes) {
        Write-Host "  [OK] Blocked: $($exe.Exe)" -ForegroundColor Green
    }
} else {
    Write-Host "  [WARN] DisallowRun not enabled" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  COMPLETE - Edge auto-reinstall is blocked" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: If Windows still manages to reinstall Edge," -ForegroundColor Yellow
Write-Host "the 'sfc /scannow' command may need to be run to" -ForegroundColor Yellow
Write-Host "repair system files that reference Edge." -ForegroundColor Yellow
Write-Host ""
Write-Host "To REVERT these changes later, run this script" -ForegroundColor Yellow
Write-Host "with the -Revert switch (not yet implemented)." -ForegroundColor Yellow
