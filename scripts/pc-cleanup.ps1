# PC Cleanup Script - Free Up Disk Space
# Run as normal user (some operations need admin for full effect)

$ErrorActionPreference = "SilentlyContinue"
$beforeFree = (Get-PSDrive C).Free

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   PC CLEANUP - Freeing Disk Space" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Free space BEFORE cleanup: $([math]::Round($beforeFree/1GB, 2)) GB" -ForegroundColor Yellow
Write-Host ""

$totalFreed = 0

function Get-FolderSize($path) {
    if (Test-Path $path) {
        $items = Get-ChildItem $path -Recurse -Force -File -ErrorAction SilentlyContinue
        return ($items | Measure-Object -Property Length -Sum).Sum
    }
    return 0
}

function Remove-Clean($path, $label) {
    if (Test-Path $path) {
        $size = Get-FolderSize $path
        Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
        # Also remove empty parent dirs
        $parent = Split-Path $path -Parent
        Get-ChildItem $parent -Directory -ErrorAction SilentlyContinue | Where-Object { 
            (Get-ChildItem $_.FullName -Force -ErrorAction SilentlyContinue | Measure-Object).Count -eq 0 
        } | Remove-Item -Force -ErrorAction SilentlyContinue
        $script:totalFreed += $size
        if ($size -gt 0) {
            Write-Host "  [CLEANED] $label - $([math]::Round($size/1MB, 1)) MB" -ForegroundColor Green
        }
    }
}

function Remove-Wildcard($pathPattern, $label) {
    $items = Get-ChildItem $pathPattern -ErrorAction SilentlyContinue
    $size = 0
    foreach ($item in $items) {
        if ($item.PSIsContainer) {
            $size += Get-FolderSize $item.FullName
            Remove-Item $item.FullName -Recurse -Force -ErrorAction SilentlyContinue
        } else {
            $size += $item.Length
            Remove-Item $item.FullName -Force -ErrorAction SilentlyContinue
        }
    }
    $script:totalFreed += $size
    if ($size -gt 0) {
        Write-Host "  [CLEANED] $label - $([math]::Round($size/1MB, 1)) MB" -ForegroundColor Green
    }
}

# ============================================
# 1. WINDOWS TEMP FILES
# ============================================
Write-Host "[1/8] Windows Temp Files" -ForegroundColor Cyan

Remove-Clean "$env:TEMP" "User Temp ($env:TEMP)"
Remove-Wildcard "$env:TEMP\*" "User Temp remaining files"
Remove-Clean "C:\Windows\Temp" "Windows Temp"
Remove-Wildcard "C:\Windows\Temp\*" "Windows Temp remaining files"

# ============================================
# 2. RECYCLE BIN
# ============================================
Write-Host "[2/8] Recycle Bin" -ForegroundColor Cyan

$recycleBin = (New-Object -ComObject Shell.Application).NameSpace(0xa)
$rbCount = $recycleBin.Items().Count
if ($rbCount -gt 0) {
    $rbSize = 0
    foreach ($item in $recycleBin.Items()) {
        $rbSize += $item.Size
    }
    Clear-RecycleBin -Force -ErrorAction SilentlyContinue
    $script:totalFreed += $rbSize
    Write-Host "  [CLEANED] Recycle Bin ($rbCount items) - $([math]::Round($rbSize/1MB, 1)) MB" -ForegroundColor Green
} else {
    Write-Host "  [EMPTY] Recycle Bin is already empty" -ForegroundColor Gray
}

# ============================================
# 3. BROWSER CACHES
# ============================================
Write-Host "[3/8] Browser Caches" -ForegroundColor Cyan

# Chrome cache
Remove-Clean "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache" "Chrome Cache"
Remove-Clean "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Code Cache" "Chrome Code Cache"
Remove-Clean "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Service Worker\CacheStorage" "Chrome SW Cache"
Remove-Clean "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Service Worker\ScriptCache" "Chrome SW ScriptCache"
Remove-Clean "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\GPUCache" "Chrome GPU Cache"
Remove-Clean "$env:LOCALAPPDATA\Google\Chrome\User Data\ShaderCache" "Chrome ShaderCache"
Remove-Wildcard "$env:LOCALAPPDATA\Google\Chrome\User Data\*\Cache" "Chrome Profile Caches"
Remove-Wildcard "$env:LOCALAPPDATA\Google\Chrome\User Data\*\Code Cache" "Chrome Profile Code Caches"

# Edge remnants
Remove-Clean "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache" "Edge Cache"
Remove-Clean "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Code Cache" "Edge Code Cache"
Remove-Wildcard "$env:LOCALAPPDATA\Microsoft\Edge\User Data\*\Cache" "Edge Profile Caches"

# Firefox cache
Remove-Clean "$env:LOCALAPPDATA\Mozilla\Firefox\Profiles" "Firefox Profiles"
Remove-Wildcard "$env:LOCALAPPDATA\Mozilla\Firefox\Profiles\*\cache2" "Firefox Cache"
Remove-Wildcard "$env:LOCALAPPDATA\Mozilla\Firefox\Profiles\*\startupCache" "Firefox Startup Cache"

# Brave cache
Remove-Clean "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data\Default\Cache" "Brave Cache"

# ============================================
# 4. WINDOWS UPDATE CACHE
# ============================================
Write-Host "[4/8] Windows Update & System Caches" -ForegroundColor Cyan

Remove-Clean "C:\Windows\SoftwareDistribution\Download" "Windows Update Download Cache"
Remove-Clean "C:\Windows\SoftwareDistribution\DataStore\DataStore.jfm" "WU DataStore"

# ============================================
# 5. THUMBNAIL CACHE
# ============================================
Write-Host "[5/8] Thumbnail & Icon Caches" -ForegroundColor Cyan

Remove-Clean "$env:LOCALAPPDATA\Microsoft\Windows\Explorer" "Thumbnail Cache"
Remove-Wildcard "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_*.db" "Thumbnail DB Files"

# ============================================
# 6. WINDOWS ERROR REPORTING
# ============================================
Write-Host "[6/8] Windows Error Reporting & Logs" -ForegroundColor Cyan

Remove-Clean "C:\ProgramData\Microsoft\Windows\WER\ReportArchive" "WER Report Archive"
Remove-Clean "C:\ProgramData\Microsoft\Windows\WER\ReportQueue" "WER Report Queue"
Remove-Wildcard "C:\Windows\Logs\*.log" "Windows Log Files"
Remove-Wildcard "C:\Windows\Logs\CBS\*.log" "CBS Log Files"
Remove-Wildcard "C:\Windows\Logs\DISM\*.log" "DISM Log Files"

# ============================================
# 7. PREFETCH & DELIVERY OPTIMIZATION
# ============================================
Write-Host "[7/8] Prefetch & Delivery Optimization" -ForegroundColor Cyan

Remove-Clean "C:\Windows\Prefetch" "Prefetch Cache"
Remove-Clean "C:\Windows\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization\Cache" "Delivery Optimization Cache"
Remove-Wildcard "C:\Windows\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization\Cache\*" "Delivery Optimization Files"

# ============================================
# 8. OTHER CLEANUP
# ============================================
Write-Host "[8/8] Other Cleanup" -ForegroundColor Cyan

# npm cache
Remove-Clean "$env:APPDATA\npm-cache" "npm Cache"

# pip cache  
Remove-Clean "$env:LOCALAPPDATA\pip\cache" "pip Cache"

# Yarn cache
Remove-Clean "$env:LOCALAPPDATA\Yarn\Cache" "Yarn Cache"

# Crash dumps
Remove-Wildcard "$env:LOCALAPPDATA\CrashDumps\*" "Crash Dumps"

# Windows old temp files
Remove-Wildcard "C:\Windows\*.tmp" "Windows .tmp Files"
Remove-Wildcard "C:\Windows\Tempor~1\*" "Windows Tempor~1"

# Delivery Optimization
Remove-Clean "C:\Windows\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization" "Delivery Optimization Data"

# ============================================
# RESULTS
# ============================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   CLEANUP COMPLETE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$afterFree = (Get-PSDrive C).Free
$freedGB = [math]::Round(($afterFree - $beforeFree) / 1GB, 2)

Write-Host ""
Write-Host "Free space BEFORE: $([math]::Round($beforeFree/1GB, 2)) GB" -ForegroundColor Yellow
Write-Host "Free space AFTER:  $([math]::Round($afterFree/1GB, 2)) GB" -ForegroundColor Green
Write-Host "Total freed:       $freedGB GB" -ForegroundColor Green
Write-Host ""
