# Find All node_modules Folders and Calculate Sizes
# Scans the entire C: drive for node_modules directories

$ErrorActionPreference = "SilentlyContinue"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SCANNING FOR node_modules FOLDERS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Scanning C: drive (this may take a moment)..." -ForegroundColor Yellow
Write-Host ""

# Directories to SKIP (system dirs, Windows, Program Files core)
$skipPaths = @(
    "C:\Windows",
    "C:\Program Files\Windows Defender",
    "C:\Program Files\Windows NT",
    "C:\Program Files\Microsoft",
    "C:\Program Files (x86)\Microsoft",
    "C:\ProgramData\Microsoft",
    "C:\Recovery",
    "$env:LOCALAPPDATA\Microsoft\WindowsApps"
)

# Search root directories
$searchRoots = @(
    "C:\Users\tarfr",
    "C:\projects",
    "C:\dev",
    "C:\src",
    "C:\work",
    "C:\code",
    "C:\repos",
    "D:\",
    "E:\"
)

$allModules = @()

foreach ($root in $searchRoots) {
    if (Test-Path $root) {
        Write-Host "  Scanning: $root ..." -ForegroundColor Gray
        $found = Get-ChildItem -Path $root -Directory -Recurse -Filter "node_modules" -ErrorAction SilentlyContinue -Depth 8 | Where-Object {
            $path = $_.FullName
            $skip = $false
            foreach ($sp in $skipPaths) {
                if ($path.StartsWith($sp)) { $skip = $true; break }
            }
            # Skip .git directories
            if ($path -match '\\\.git\\') { $skip = $true }
            # Skip hidden directories
            if ($_.Attributes -band [IO.FileAttributes]::Hidden) { $skip = $true }
            -not $skip
        }
        $allModules += $found
    }
}

# Also check for node_modules in common sub-locations
Write-Host "  Scanning: AppData, .npm, etc. ..." -ForegroundColor Gray
$extraSearch = @(
    "$env:LOCALAPPDATA\npm-cache",
    "$env:APPDATA\npm",
    "$env:USERPROFILE\\.npm",
    "$env:USERPROFILE\\.nvm",
    "$env:USERPROFILE\\.vscode",
    "$env:USERPROFILE\\.android",
    "$env:USERPROFILE\\.gradle",
    "$env:USERPROFILE\\.cargo",
    "$env:USERPROFILE\\.docker"
)

foreach ($loc in $extraSearch) {
    if (Test-Path $loc) {
        $found = Get-ChildItem -Path $loc -Directory -Recurse -Filter "node_modules" -ErrorAction SilentlyContinue -Depth 6
        $allModules += $found
    }
}

Write-Host ""
Write-Host "Found $($allModules.Count) node_modules folders" -ForegroundColor Cyan
Write-Host ""

if ($allModules.Count -eq 0) {
    Write-Host "No node_modules folders found on the system!" -ForegroundColor Green
    Write-Host ""
    
    # Check for other large package caches
    Write-Host "=== Checking other package manager caches ===" -ForegroundColor Yellow
    
    $caches = @(
        @{ Path = "$env:LOCALAPPDATA\npm-cache"; Name = "npm cache" },
        @{ Path = "$env:LOCALAPPDATA\pip\cache"; Name = "pip cache" },
        @{ Path = "$env:LOCALAPPDATA\Yarn\Cache"; Name = "Yarn cache" },
        @{ Path = "$env:APPDATA\npm-cache"; Name = "npm cache (AppData)" },
        @{ Path = "$env:LOCALAPPDATA\pnpm-store"; Name = "pnpm store" },
        @{ Path = "$env:LOCALAPPDATA\pnpm"; Name = "pnpm" },
        @{ Path = "$env:APPDATA\pnpm-store"; Name = "pnpm store (AppData)" },
        @{ Path = "$env:USERPROFILE\\.nuget"; Name = "NuGet cache" },
        @{ Path = "$env:LOCALAPPDATA\Pub\Cache"; Name = "NuGet packages" },
        @{ Path = "$env:USERPROFILE\\.cargo\registry"; Name = "Cargo/Rust cache" },
        @{ Path = "$env:USERPROFILE\\.pub-cache"; Name = "Dart/Pub cache" },
        @{ Path = "$env:LOCALAPPDATA\Composer"; Name = "Composer cache" },
        @{ Path = "$env:APPDATA\Composer\cache"; Name = "Composer cache (AppData)" },
        @{ Path = "$env:LOCALAPPDATA\Gradle\caches"; Name = "Gradle cache" },
        @{ Path = "$env:USERPROFILE\\.m2\repository"; Name = "Maven cache" },
        @{ Path = "$env:APPDATA\Code\Cache"; Name = "VS Code Cache" },
        @{ Path = "$env:APPDATA\Code\CachedData"; Name = "VS Code Cached Data" },
        @{ Path = "$env:APPDATA\Code\CachedExtensionVSIXs"; Name = "VS Code Extension Cache" },
        @{ Path = "$env:APPDATA\Code\logs"; Name = "VS Code Logs" }
    )
    
    $totalCache = 0
    foreach ($cache in $caches) {
        if (Test-Path $cache.Path) {
            $size = (Get-ChildItem $cache.Path -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            $sizeMB = [math]::Round($size / 1MB, 1)
            if ($sizeMB -gt 1) {
                Write-Host "  $($cache.Name): $sizeMB MB" -ForegroundColor White
                $totalCache += $size
            }
        }
    }
    Write-Host ""
    Write-Host "Total other caches: $([math]::Round($totalCache/1MB, 1)) MB" -ForegroundColor Yellow
    
} else {
    # Sort by size descending
    $results = @()
    foreach ($mod in $allModules) {
        $size = (Get-ChildItem $mod.FullName -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $results += [PSCustomObject]@{
            Path = $mod.FullName
            SizeMB = [math]::Round($size / 1MB, 1)
            SizeGB = [math]::Round($size / 1GB, 2)
            Parent = Split-Path (Split-Path $mod.FullName -Parent) -Leaf
        }
    }
    
    $results = $results | Sort-Object SizeMB -Descending
    
    Write-Host "=== node_modules Folders (sorted by size) ===" -ForegroundColor Yellow
    Write-Host ""
    
    $totalMB = 0
    $i = 1
    foreach ($r in $results) {
        $sizeStr = if ($r.SizeMB -gt 1024) { "$($r.SizeGB) GB" } else { "$($r.SizeMB) MB" }
        Write-Host "  [$i] $($r.Path)" -ForegroundColor White
        Write-Host "      Size: $sizeStr (project: $($r.Parent))" -ForegroundColor Gray
        $totalMB += $r.SizeMB
        $i++
        if ($i -gt 50) { break }  # Show max 50
    }
    
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  Total: $($allModules.Count) folders, $([math]::Round($totalMB/1024, 2)) GB" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Cyan
}
