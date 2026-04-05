# CompressX one-line uninstaller for Windows
# Usage: powershell -c "irm https://compressx.asmith.media/uninstall.ps1 | iex"

$ErrorActionPreference = "Stop"

# Try to enable UTF-8 output, silently fall back on older hosts
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

Write-Host ""
Write-Host "  CompressX Uninstaller" -ForegroundColor White
Write-Host "  ====================================="
Write-Host ""

$compressxDir = "$env:USERPROFILE\.compressx"

# Show what will be removed
if (Test-Path $compressxDir) {
    $size = (Get-ChildItem -Path $compressxDir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    $sizeMb = [math]::Round($size / 1MB, 1)
    Write-Host "  Data directory: " -NoNewline
    Write-Host "$compressxDir" -ForegroundColor White -NoNewline
    Write-Host " ($sizeMb MB)"
}

try {
    $cxPath = (Get-Command compressx -ErrorAction Stop).Source
    Write-Host "  CLI binary:     " -NoNewline
    Write-Host "$cxPath" -ForegroundColor White
} catch {}

Write-Host ""
Write-Host "  This will remove CompressX and all its data." -ForegroundColor Yellow
$answer = Read-Host "  Continue? [y/N]"
if ($answer -ne "y" -and $answer -ne "Y" -and $answer -ne "yes") {
    Write-Host ""
    Write-Host "  Uninstall cancelled."
    Write-Host ""
    exit 0
}

Write-Host ""

# Step 1: Uninstall the npm package
try {
    Get-Command npm -ErrorAction Stop | Out-Null
    Write-Host "  [1/2] Removing CLI via npm..." -ForegroundColor White
    npm uninstall -g compressx 2>&1 | Select-Object -Last 3
    npm uninstall -g compressx-mcp 2>&1 | Select-Object -Last 3
    Write-Host "  [OK] " -ForegroundColor Green -NoNewline
    Write-Host "CLI removed"
} catch {
    Write-Host "  [!] npm not found. Skipping CLI removal." -ForegroundColor Yellow
}

Write-Host ""

# Step 2: Remove the data directory
if (Test-Path $compressxDir) {
    Write-Host "  [2/2] Removing data directory..." -ForegroundColor White
    try {
        Remove-Item -Path $compressxDir -Recurse -Force
        Write-Host "  [OK] " -ForegroundColor Green -NoNewline
        Write-Host "Removed $compressxDir"
    } catch {
        Write-Host "  [X] Failed to remove $compressxDir" -ForegroundColor Red
        Write-Host "      $($_.Exception.Message)"
    }
} else {
    Write-Host "  [2/2] No data directory to remove."
}

Write-Host ""
Write-Host "  CompressX has been fully uninstalled." -ForegroundColor Green
Write-Host "  Thanks for trying it out."
Write-Host ""
