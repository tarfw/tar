# Cleanup Node Modules - Remove selected categories
# Categories: npx caches, codex runtimes, bun global, npm global

$ErrorActionPreference = "SilentlyContinue"
$beforeFree = (Get-PSDrive C).Free

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  NODE MODULES CLEANUP" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Free space BEFORE: $([math]::Round($beforeFree/1GB, 2)) GB" -ForegroundColor Yellow
Write-Host ""

$totalFreed = 0

function Get-FolderSize($path) {
    if (Test-Path $path) {
        $items = Get-ChildItem $path -Recurse -Force -File -ErrorAction SilentlyContinue
        return ($items | Measure-Object -Property Length -Sum).Sum
    }
    return 0
}

# ============================================
# 1. NPM NPK TEMPORARY CACHES
# ============================================
Write-Host "[1/4] Removing npx temporary caches..." -ForegroundColor Cyan

$npxPath = "$env:LOCALAPPDATA\npm-cache\_npx"
if (Test-Path $npxPath) {
    $folders = Get-ChildItem $npxPath -Directory -ErrorAction SilentlyContinue
    $count = 0
    foreach ($folder in $folders) {
        $size = Get-FolderSize $folder.FullName
        Remove-Item $folder.FullName -Recurse -Force -ErrorAction SilentlyContinue
        $script:totalFreed += $size
        $count++
    }
    Write-Host "  [CLEANED] $count npx cache folders - $([math]::Round($script:totalFreed/1MB, 0)) MB" -ForegroundColor Green
} else {
    Write-Host "  [SKIP] npx cache path not found" -ForegroundColor Gray
}

# ============================================
# 2. CODEX RUNTIME CACHE
# ============================================
Write-Host "[2/4] Removing Codex runtime cache..." -ForegroundColor Cyan

$codexPaths = @(
    "$env:USERPROFILE\.cache\codex-runtimes"
)

foreach ($cp in $codexPaths) {
    if (Test-Path $cp) {
        $size = Get-FolderSize $cp
        Remove-Item $cp -Recurse -Force -ErrorAction SilentlyContinue
        $script:totalFreed += $size
        Write-Host "  [CLEANED] $cp - $([math]::Round($size/1MB, 0)) MB" -ForegroundColor Green
    }
}

# ============================================
# 3. BUN GLOBAL PACKAGES
# ============================================
Write-Host "[3/4] Removing Bun global packages..." -ForegroundColor Cyan

$bunPaths = @(
    "$env:USERPROFILE\.bun\install\global",
    "$env:USERPROFILE\.bun\install\cache"
)

foreach ($bp in $bunPaths) {
    if (Test-Path $bp) {
        $size = Get-FolderSize $bp
        Remove-Item $bp -Recurse -Force -ErrorAction SilentlyContinue
        $script:totalFreed += $size
        Write-Host "  [CLEANED] $bp - $([math]::Round($size/1MB, 0)) MB" -ForegroundColor Green
    }
}

# ============================================
# 4. NPM GLOBAL PACKAGES
# ============================================
Write-Host "[4/4] Removing npm global packages..." -ForegroundColor Cyan

$npmGlobalModules = "$env:APPDATA\npm\node_modules"
$npmGlobalBin = "$env:APPDATA\npm"

if (Test-Path $npmGlobalModules) {
    # List packages being removed
    $packages = Get-ChildItem $npmGlobalModules -Directory -ErrorAction SilentlyContinue
    Write-Host "  Removing $($packages.Count) global packages:" -ForegroundColor Gray
    foreach ($pkg in $packages) {
        Write-Host "    - $($pkg.Name)" -ForegroundColor Gray
    }
    
    $size = Get-FolderSize $npmGlobalModules
    Remove-Item $npmGlobalModules -Recurse -Force -ErrorAction SilentlyContinue
    
    # Also remove global bin symlinks
    $binFiles = Get-ChildItem $npmGlobalBin -File -ErrorAction SilentlyContinue | Where-Object { 
        $_.Extension -in '.cmd', '.ps1', '.sh', '.bat' 
    }
    foreach ($bin in $binFiles) {
        Remove-Item $bin.FullName -Force -ErrorAction SilentlyContinue
    }
    
    $script:totalFreed += $size
    Write-Host "  [CLEANED] npm global modules - $([math]::Round($size/1MB, 0)) MB" -ForegroundColor Green
}

# ============================================
# CLEAN UP EMPTY DIRECTORIES
# ============================================
Write-Host ""
Write-Host "Cleaning up empty directories..." -ForegroundColor Gray

$emptyPaths = @(
    "$env:LOCALAPPDATA\npm-cache\_npx",
    "$env:USERPROFILE\.cache\codex-runtimes",
    "$env:USERPROFILE\.bun"
)

foreach ($ep in $emptyPaths) {
    if (Test-Path $ep) {
        $items = Get-ChildItem $ep -Recurse -Force -ErrorAction SilentlyContinue
        if ($items.Count -eq 0) {
            Remove-Item $ep -Force -ErrorAction SilentlyContinue
            Write-Host "  [REMOVED] Empty dir: $ep" -ForegroundColor Gray
        }
    }
}

# ============================================
# RESULTS
# ============================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CLEANUP COMPLETE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$afterFree = (Get-PSDrive C).Free
$freedGB = [math]::Round(($afterFree - $beforeFree) / 1GB, 2)

Write-Host ""
Write-Host "Free space BEFORE: $([math]::Round($beforeFree/1GB, 2)) GB" -ForegroundColor Yellow
Write-Host "Free space AFTER:  $([math]::Round($afterFree/1GB, 2)) GB" -ForegroundColor Green
Write-Host "Total freed:       $freedGB GB" -ForegroundColor Green
Write-Host ""
Write-Host "NOTE: To reinstall npm global packages you were using:" -ForegroundColor Yellow
Write-Host "  npm install -g wrangler vercel claude-code opencode-ai eas-cli expo-cli" -ForegroundColor Gray
Write-Host ""
Write-Host "To reinstall Bun global packages:" -ForegroundColor Yellow
Write-Host "  bun install -g <package-name>" -ForegroundColor Gray
Write-Host ""
