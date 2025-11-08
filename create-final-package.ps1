# Screenshot Algo - Final Deployment Package with Frontend Build
# Version 1.1.0

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputName = "Screenshot_Algo_FINAL_$timestamp"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Screenshot Algo - Deployment Package Creator" -ForegroundColor Cyan
Write-Host "  Version 1.1.0 - With Pre-built Frontend" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop containers and clean database
Write-Host "[1/6] Stopping containers and cleaning database..." -ForegroundColor Yellow
docker-compose down -v 2>&1 | Out-Null
Write-Host "   Done!" -ForegroundColor Green
Write-Host ""

# Step 2: Build backend
Write-Host "[2/6] Building backend..." -ForegroundColor Yellow
Set-Location backend
npm run build 2>&1 | Out-Null
Set-Location ..
Write-Host "   Done!" -ForegroundColor Green
Write-Host ""

# Step 3: Build frontend
Write-Host "[3/6] Building frontend..." -ForegroundColor Yellow
Set-Location frontend
npm run build 2>&1 | Out-Null
Set-Location ..
Write-Host "   Done!" -ForegroundColor Green
Write-Host ""

# Step 4: Remove test files
Write-Host "[4/6] Removing test files..." -ForegroundColor Yellow
$testPatterns = @("test-*.js", "analyze-*.js", "check-*.js", "compare-*.js", "crawl-*.js", "comprehensive-*.js")
foreach ($pattern in $testPatterns) {
    Get-ChildItem -Path . -Filter $pattern -File -ErrorAction SilentlyContinue | Remove-Item -Force
}
Write-Host "   Done!" -ForegroundColor Green
Write-Host ""

# Step 5: Create ZIP package
Write-Host "[5/6] Creating ZIP package..." -ForegroundColor Yellow

$files = @(
    "backend",
    "frontend",
    "docker-compose.yml",
    "START.bat",
    "STOP.bat",
    "UPDATE.bat",
    ".env.example",
    "README.md",
    "DEPLOYMENT_README.md",
    "COMPREHENSIVE_TEST_REPORT.md",
    "MEMORY_LEAK_FIXES.md",
    "VARIANT_DETECTION_FIXED.md"
)

$tempDir = Join-Path $env:TEMP "screenshot_algo_temp"
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

foreach ($file in $files) {
    if (Test-Path $file) {
        $destPath = Join-Path $tempDir $file
        Copy-Item -Path $file -Destination $destPath -Recurse -Force
    }
}

$zipPath = "$outputName.zip"
if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
}

Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -CompressionLevel Optimal -Force
Remove-Item -Path $tempDir -Recurse -Force

$size = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host "   Package created: $outputName.zip ($size MB)" -ForegroundColor Green
Write-Host ""

# Step 6: Create info file
Write-Host "[6/6] Creating info file..." -ForegroundColor Yellow

$infoContent = @"
Screenshot Algo - Final Deployment Package
Version: 1.1.0
Build Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Features:
- Memory Leak Fixes (Browser cleanup)
- Variant Detection (Shopware 6)
- Graceful Shutdown (SIGTERM/SIGINT)
- Empty Database (ready for your data)
- Pre-built Frontend (included in package)

Installation:
1. Extract ZIP file
2. Run START.bat
3. Open http://localhost:3000

Documentation: See DEPLOYMENT_README.md
"@

Set-Content -Path "$outputName.txt" -Value $infoContent
Write-Host "   Done!" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  DEPLOYMENT PACKAGE READY!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Package: $outputName.zip ($size MB)" -ForegroundColor White
Write-Host "Database: Empty (ready for crawling)" -ForegroundColor White
Write-Host "Frontend: Pre-built and included" -ForegroundColor White
Write-Host ""
Write-Host "Ready for deployment!" -ForegroundColor Green
Write-Host ""
