# AI Tool Config Cleanup Script
# Cleans opencode, kilo, mimocode configs and caches

$ErrorActionPreference = "SilentlyContinue"
$userProfile = $env:USERPROFILE

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  AI TOOL CONFIG CLEANUP" -ForegroundColor Cyan
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
# 1. OPENCODE
# ============================================
Write-Host "[1/3] opencode..." -ForegroundColor Cyan
Remove-CacheFolder "$userProfile\.config\opencode" "opencode config"
Remove-CacheFolder "$userProfile\.local\share\opencode" "opencode data"

# ============================================
# 2. KILO
# ============================================
Write-Host "`n[2/3] kilo..." -ForegroundColor Cyan
Remove-CacheFolder "$userProfile\.config\kilo" "kilo config"
Remove-CacheFolder "$userProfile\.local\share\kilo" "kilo data"

# ============================================
# 3. MIMOCODE
# ============================================
Write-Host "`n[3/3] mimocode..." -ForegroundColor Cyan
Remove-CacheFolder "$userProfile\.mimocode" "mimocode config"
Remove-CacheFolder "$userProfile\.config\mimocode" "mimocode config (alt)"

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
Write-Host "Note: These tools will recreate configs on next launch if needed." -ForegroundColor Yellow
