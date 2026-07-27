# Dev Cache Cleanup Script
# Cleans Bun, Fly.io, and other development tool caches

$ErrorActionPreference = "SilentlyContinue"
$userProfile = $env:USERPROFILE

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DEV CACHE CLEANUP" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$totalFreed = 0

function Get-DirSize($path) {
    if (Test-Path $path) {
        $items = Get-ChildItem $path -Recurse -Force -File -ErrorAction SilentlyContinue
        return ($items | Measure-Object -Property Length -Sum).Sum
    }
    return 0
}

function Remove-CacheFolder($path, $label) {
    if (Test-Path $path) {
        $size = Get-DirSize $path
        if ($size -gt 0) {
            Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
            if (-not (Test-Path $path)) {
                $script:totalFreed += $size
                Write-Host "  [CLEANED] $label - $([math]::Round($size/1MB, 1)) MB" -ForegroundColor Green
            } else {
                Write-Host "  [PARTIAL] $label - some files locked" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  [EMPTY] $label - already clean" -ForegroundColor Gray
        }
    } else {
        Write-Host "  [SKIP] $label - not found" -ForegroundColor Gray
    }
}

# ============================================
# 1. BUN CACHE
# ============================================
Write-Host "[1/4] Bun caches..." -ForegroundColor Cyan
Remove-CacheFolder "$userProfile\.bun\install\cache" "Bun install cache"
Remove-CacheFolder "$userProfile\.bun\install\global" "Bun global packages"
Remove-CacheFolder "$userProfile\.bun\bin" "Bun binaries"

# ============================================
# 2. FLY.IO CACHE
# ============================================
Write-Host "`n[2/4] Fly.io cache..." -ForegroundColor Cyan
Remove-CacheFolder "$userProfile\.fly" "Fly.io cache"

# ============================================
# 3. NPM / YARN / PNPM CACHES
# ============================================
Write-Host "`n[3/4] Package manager caches..." -ForegroundColor Cyan
Remove-CacheFolder "$env:LOCALAPPDATA\npm-cache\_npx" "npx cache"
Remove-CacheFolder "$env:LOCALAPPDATA\npm-cache\_cacache" "npm cacache"
Remove-CacheFolder "$env:LOCALAPPDATA\pnpm-store" "pnpm store"
Remove-CacheFolder "$env:LOCALAPPDATA\Yarn\Cache" "Yarn cache"
Remove-CacheFolder "$userProfile\.npm" "npm cache (~/.npm)"

# ============================================
# 4. OTHER DEV TOOL CACHES
# ============================================
Write-Host "`n[4/4] Other dev caches..." -ForegroundColor Cyan
Remove-CacheFolder "$userProfile\.gradle\caches" "Gradle cache"
Remove-CacheFolder "$userProfile\.m2\repository" "Maven cache"
Remove-CacheFolder "$userProfile\.cargo\registry\cache" "Cargo cache"
Remove-CacheFolder "$env:LOCALAPPDATA\pip\cache" "pip cache"
Remove-CacheFolder "$env:LOCALAPPDATA\Pub\Cache" "Dart/Pub cache"

# ============================================
# RESULTS
# ============================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CLEANUP COMPLETE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total freed: $([math]::Round($totalFreed/1MB, 1)) MB" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Caches will rebuild automatically on next use." -ForegroundColor Yellow
