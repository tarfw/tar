# Deep PC Cleanup Scanner
# Finds all large folders that can potentially be cleaned

$ErrorActionPreference = "SilentlyContinue"
$userProfile = $env:USERPROFILE
$appDataLocal = $env:LOCALAPPDATA
$appDataRoaming = $env:APPDATA

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DEEP PC CLEANUP SCAN" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

function Get-DirSize($path) {
    if (Test-Path $path) {
        $items = Get-ChildItem $path -Recurse -Force -File -ErrorAction SilentlyContinue
        return ($items | Measure-Object -Property Length -Sum).Sum
    }
    return 0
}

function Show-Category($title, $items) {
    Write-Host "`n=== $title ===" -ForegroundColor Yellow
    foreach ($item in $items) {
        if ($item.SizeMB -gt 1) {
            $color = if ($item.SizeMB -gt 500) { "Red" } elseif ($item.SizeMB -gt 100) { "Yellow" } else { "Gray" }
            Write-Host ("  {0,-50} {1,8} MB" -f $item.Path, $item.SizeMB) -ForegroundColor $color
        }
    }
}

# ============================================
# 1. USER PROFILE FOLDERS
# ============================================
Write-Host "[1/8] Scanning user profile..." -ForegroundColor Cyan
$profileItems = @()
Get-ChildItem $userProfile -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $size = Get-DirSize $_.FullName
    $profileItems += [PSCustomObject]@{
        Path = $_.Name
        SizeMB = [math]::Round($size / 1MB, 1)
    }
}
$profileItems = $profileItems | Sort-Object SizeMB -Descending
Show-Category "User Profile Folders" $profileItems

# ============================================
# 2. APPDATA\LOCAL - CACHES
# ============================================
Write-Host "`n[2/8] Scanning AppData\Local caches..." -ForegroundColor Cyan
$localItems = @()
Get-ChildItem $appDataLocal -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $size = Get-DirSize $_.FullName
    $localItems += [PSCustomObject]@{
        Path = $_.Name
        SizeMB = [math]::Round($size / 1MB, 1)
    }
}
$localItems = $localItems | Sort-Object SizeMB -Descending
Show-Category "AppData\Local" $localItems

# ============================================
# 3. APPDATA\ROAMING
# ============================================
Write-Host "`n[3/8] Scanning AppData\Roaming..." -ForegroundColor Cyan
$roamingItems = @()
Get-ChildItem $appDataRoaming -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $size = Get-DirSize $_.FullName
    $roamingItems += [PSCustomObject]@{
        Path = $_.Name
        SizeMB = [math]::Round($size / 1MB, 1)
    }
}
$roamingItems = $roamingItems | Sort-Object SizeMB -Descending
Show-Category "AppData\Roaming" $roamingItems

# ============================================
# 4. DOTFILE CACHES
# ============================================
Write-Host "`n[4/8] Scanning dotfile caches..." -ForegroundColor Cyan
$dotItems = @()
$dotPaths = @(
    "$userProfile\.cache",
    "$userProfile\.npm",
    "$userProfile\.bun",
    "$userProfile\.cargo",
    "$userProfile\\.gradle",
    "$userProfile\\.android",
    "$userProfile\\.docker",
    "$userProfile\\.vscode",
    "$userProfile\\.local"
)
foreach ($dp in $dotPaths) {
    if (Test-Path $dp) {
        $size = Get-DirSize $dp
        $name = $dp.Replace($userProfile + "\", "")
        $dotItems += [PSCustomObject]@{
            Path = $name
            SizeMB = [math]::Round($size / 1MB, 1)
        }
    }
}
$dotItems = $dotItems | Sort-Object SizeMB -Descending
Show-Category "Dotfile Caches" $dotItems

# ============================================
# 5. BROWSER DATA
# ============================================
Write-Host "`n[5/8] Scanning browser data..." -ForegroundColor Cyan
$browserPaths = @(
    @{ Path = "$appDataLocal\Google\Chrome\User Data"; Name = "Chrome" },
    @{ Path = "$appDataLocal\Microsoft\Edge\User Data"; Name = "Edge" },
    @{ Path = "$appDataLocal\BraveSoftware\Brave-Browser\User Data"; Name = "Brave" },
    @{ Path = "$appDataLocal\Mozilla\Firefox\Profiles"; Name = "Firefox" }
)
$browserItems = @()
foreach ($bp in $browserPaths) {
    if (Test-Path $bp.Path) {
        $size = Get-DirSize $bp.Path
        $browserItems += [PSCustomObject]@{
            Path = $bp.Name
            SizeMB = [math]::Round($size / 1MB, 1)
        }
    }
}
$browserItems = $browserItems | Sort-Object SizeMB -Descending
Show-Category "Browser Data" $browserItems

# ============================================
# 6. DEVELOPMENT TOOLS
# ============================================
Write-Host "`n[6/8] Scanning development tools..." -ForegroundColor Cyan
$devPaths = @(
    @{ Path = "$appDataLocal\npm-cache"; Name = "npm cache" },
    @{ Path = "$appDataLocal\pnpm-store"; Name = "pnpm store" },
    @{ Path = "$appDataLocal\Yarn\Cache"; Name = "Yarn cache" },
    @{ Path = "$userProfile\.nuget"; Name = "NuGet cache" },
    @{ Path = "$userProfile\.cargo\registry"; Name = "Cargo cache" },
    @{ Path = "$userProfile\.gradle\caches"; Name = "Gradle cache" },
    @{ Path = "$userProfile\\.m2\repository"; Name = "Maven cache" },
    @{ Path = "$appDataLocal\Docker"; Name = "Docker" }
)
$devItems = @()
foreach ($dp in $devPaths) {
    if (Test-Path $dp.Path) {
        $size = Get-DirSize $dp.Path
        $devItems += [PSCustomObject]@{
            Path = $dp.Name
            SizeMB = [math]::Round($size / 1MB, 1)
        }
    }
}
$devItems = $devItems | Sort-Object SizeMB -Descending
Show-Category "Development Tools" $devItems

# ============================================
# 7. WINDOWS TEMP & LOGS
# ============================================
Write-Host "`n[7/8] Scanning Windows temp & logs..." -ForegroundColor Cyan
$winPaths = @(
    @{ Path = "$env:TEMP"; Name = "User Temp" },
    @{ Path = "C:\Windows\Temp"; Name = "Windows Temp" },
    @{ Path = "C:\Windows\SoftwareDistribution\Download"; Name = "Windows Update Cache" },
    @{ Path = "C:\Windows\Logs"; Name = "Windows Logs" },
    @{ Path = "C:\ProgramData\Microsoft\Windows\WER"; Name = "Error Reports" }
)
$winItems = @()
foreach ($wp in $winPaths) {
    if (Test-Path $wp.Path) {
        $size = Get-DirSize $wp.Path
        $winItems += [PSCustomObject]@{
            Path = $wp.Name
            SizeMB = [math]::Round($size / 1MB, 1)
        }
    }
}
$winItems = $winItems | Sort-Object SizeMB -Descending
Show-Category "Windows Temp & Logs" $winItems

# ============================================
# 8. LARGE FILES IN HOME
# ============================================
Write-Host "`n[8/8] Scanning for large files (>100MB)..." -ForegroundColor Cyan
$largeFiles = Get-ChildItem $userProfile -Recurse -Force -File -ErrorAction SilentlyContinue | 
    Where-Object { $_.Length -gt 100MB } |
    Select-Object FullName, @{N='SizeMB';E={[math]::Round($_.Length/1MB,1)}} |
    Sort-Object SizeMB -Descending |
    Select-Object -First 20

if ($largeFiles) {
    Write-Host ""
    foreach ($f in $largeFiles) {
        $color = if ($f.SizeMB -gt 500) { "Red" } elseif ($f.SizeMB -gt 200) { "Yellow" } else { "Gray" }
        Write-Host ("  {0,-60} {1,8} MB" -f $f.FullName, $f.SizeMB) -ForegroundColor $color
    }
} else {
    Write-Host "  No files larger than 100MB found" -ForegroundColor Gray
}

# ============================================
# SUMMARY
# ============================================
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  SCAN COMPLETE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$totalProfile = ($profileItems | Measure-Object -Property SizeMB -Sum).Sum
$totalLocal = ($localItems | Measure-Object -Property SizeMB -Sum).Sum
$totalRoaming = ($roamingItems | Measure-Object -Property SizeMB -Sum).Sum
$totalDot = ($dotItems | Measure-Object -Property SizeMB -Sum).Sum
$totalBrowser = ($browserItems | Measure-Object -Property SizeMB -Sum).Sum
$totalDev = ($devItems | Measure-Object -Property SizeMB -Sum).Sum
$totalWin = ($winItems | Measure-Object -Property SizeMB -Sum).Sum

Write-Host "Summary by category:" -ForegroundColor Yellow
Write-Host ("  User Profile:        {0,8} MB" -f $totalProfile)
Write-Host ("  AppData\Local:       {0,8} MB" -f $totalLocal)
Write-Host ("  AppData\Roaming:     {0,8} MB" -f $totalRoaming)
Write-Host ("  Dotfile Caches:      {0,8} MB" -f $totalDot)
Write-Host ("  Browser Data:        {0,8} MB" -f $totalBrowser)
Write-Host ("  Dev Tools:           {0,8} MB" -f $totalDev)
Write-Host ("  Windows Temp/Logs:   {0,8} MB" -f $totalWin)
Write-Host ""
Write-Host "Total scanned: $([math]::Round(($totalProfile+$totalLocal+$totalRoaming+$totalDot+$totalBrowser+$totalDev+$totalWin)/1024, 2)) GB" -ForegroundColor Green
