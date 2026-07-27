# Chrome Cache Cleanup Script
# Cleans Service Worker, GPU Cache, Shader Cache across all Chrome profiles
# Safe to run - does not touch history, passwords, bookmarks, or extensions

$ErrorActionPreference = "SilentlyContinue"
$chromeDir = "$env:LOCALAPPDATA\Google\Chrome\User Data"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CHROME CACHE CLEANUP" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $chromeDir)) {
    Write-Host "Chrome User Data not found at $chromeDir" -ForegroundColor Red
    exit 1
}

# Check if Chrome is running
$chromeProcs = Get-Process chrome -EA 0
if ($chromeProcs) {
    Write-Host "WARNING: Chrome is running! Close Chrome first for best results." -ForegroundColor Yellow
    Write-Host "Attempting cleanup anyway..." -ForegroundColor Gray
} else {
    Write-Host "Chrome is not running - safe to clean." -ForegroundColor Green
}

Write-Host ""

$totalFreed = 0

function Get-DirSize($path) {
    if (Test-Path $path) {
        $items = Get-ChildItem $path -Recurse -Force -File -ErrorAction SilentlyContinue
        return ($items | Measure-Object -Property Length -Sum).Sum
    }
    return 0
}

# Get all profile directories
$profiles = Get-ChildItem $chromeDir -Directory -Force | Where-Object {
    $_.Name -match "^(Default|Profile \d+|Guest Profile|System Profile)$"
}

Write-Host "Found $($profiles.Count) Chrome profiles" -ForegroundColor Cyan
Write-Host ""

foreach ($profile in $profiles) {
    $profileName = $profile.Name
    $cleaned = $false
    
    # Folders to clean (safe - no user data)
    $cacheFolders = @(
        "Service Worker\CacheStorage",
        "Service Worker\ScriptCache", 
        "Service Worker",
        "GPUCache",
        "GrShaderCache",
        "DawnWebGPUCache",
        "DawnGraphiteCache",
        "Cache",
        "Code Cache"
    )
    
    foreach ($folder in $cacheFolders) {
        $path = Join-Path $profile.FullName $folder
        if (Test-Path $path) {
            $size = Get-DirSize $path
            if ($size -gt 0) {
                Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
                if (-not (Test-Path $path)) {
                    $totalFreed += $size
                    $cleaned = $true
                    Write-Host "  [$profileName] Cleaned $folder - $([math]::Round($size/1MB, 1)) MB" -ForegroundColor Green
                }
            }
        }
    }
    
    if (-not $cleaned) {
        Write-Host "  [$profileName] No cache folders to clean" -ForegroundColor Gray
    }
}

# Also clean the root ShaderCache
$shaderCache = Join-Path $chromeDir "ShaderCache"
if (Test-Path $shaderCache) {
    $size = Get-DirSize $shaderCache
    if ($size -gt 0) {
        Remove-Item $shaderCache -Recurse -Force -ErrorAction SilentlyContinue
        $totalFreed += $size
        Write-Host "  [Root] Cleaned ShaderCache - $([math]::Round($size/1MB, 1)) MB" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CLEANUP COMPLETE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total freed: $([math]::Round($totalFreed/1MB, 1)) MB" -ForegroundColor Green
Write-Host ""
Write-Host "Note: History, passwords, bookmarks, and extensions are untouched." -ForegroundColor Yellow
