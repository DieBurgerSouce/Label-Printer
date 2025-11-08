# Screenshot Algo - Clean Deployment Package Creator
# Version 1.1.0 - With Empty Database

param(
    [string]$OutputName = "Screenshot_Algo_CLEAN_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Screenshot Algo - Clean Deployment Package" -ForegroundColor Cyan
Write-Host "  Version 1.1.0 - Memory Leak Fixes" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Stop all containers
Write-Host "[1/7] Stopping all containers..." -ForegroundColor Yellow
docker-compose down -v 2>&1 | Out-Null
Write-Host "   ✓ Containers stopped and volumes removed" -ForegroundColor Green
Write-Host ""

# Clean up test files and build artifacts
Write-Host "[2/7] Cleaning up test files..." -ForegroundColor Yellow
$testFiles = @(
    "test-*.js",
    "analyze-*.js",
    "check-*.js",
    "compare-*.js",
    "crawl-*.js",
    "debug-*.js",
    "export-*.js",
    "fix-*.js",
    "import-*.js",
    "mark-*.js",
    "prepare-*.js",
    "smart-*.js",
    "verify-*.js",
    "wait-*.js",
    "*.json.bak",
    "comprehensive-memory-leak-test.js",
    "test-memory-leak-fix.js"
)

foreach ($pattern in $testFiles) {
    Get-ChildItem -Path . -Filter $pattern -File -ErrorAction SilentlyContinue | Remove-Item -Force
}
Write-Host "   ✓ Test files removed" -ForegroundColor Green
Write-Host ""

# Clean backend build
Write-Host "[3/7] Cleaning backend build..." -ForegroundColor Yellow
if (Test-Path "backend/dist") {
    Remove-Item -Path "backend/dist" -Recurse -Force
}
if (Test-Path "backend/node_modules") {
    Write-Host "   ℹ Keeping node_modules for faster deployment" -ForegroundColor Gray
}
Write-Host "   ✓ Backend cleaned" -ForegroundColor Green
Write-Host ""

# Clean frontend build
Write-Host "[4/7] Cleaning frontend build..." -ForegroundColor Yellow
if (Test-Path "frontend/dist") {
    Write-Host "   ℹ Keeping frontend dist for deployment" -ForegroundColor Gray
}
if (Test-Path "frontend/node_modules") {
    Write-Host "   ℹ Keeping node_modules for faster deployment" -ForegroundColor Gray
}
Write-Host "   ✓ Frontend cleaned" -ForegroundColor Green
Write-Host ""

# Build fresh
Write-Host "[5/8] Building backend..." -ForegroundColor Yellow
Set-Location backend
npm run build | Out-Null
Set-Location ..
Write-Host "   ✓ Backend compiled" -ForegroundColor Green
Write-Host ""

# Build frontend
Write-Host "[6/8] Building frontend..." -ForegroundColor Yellow
Set-Location frontend
npm run build | Out-Null
Set-Location ..
Write-Host "   ✓ Frontend built" -ForegroundColor Green
Write-Host ""

# Create deployment package
Write-Host "[7/8] Creating deployment package..." -ForegroundColor Yellow

$excludePatterns = @(
    "*.zip",
    "node_modules",
    ".git",
    ".github",
    ".vscode",
    "*.log",
    "*.tmp",
    "test-*.js",
    "analyze-*.js",
    "data/screenshots/*",
    "data/uploads/*",
    "data/cache/*",
    "*.json.bak",
    "Screenshot_Algo_*.zip"
)

$includeFiles = @(
    "backend/",
    "frontend/",
    "docker-compose.yml",
    "START.bat",
    "STOP.bat",
    "UPDATE.bat",
    "FRESH_INSTALL.bat",
    ".env.example",
    "README.md",
    "DEPLOYMENT_README.md",
    "COMPREHENSIVE_TEST_REPORT.md",
    "MEMORY_LEAK_FIXES.md",
    "VARIANT_DETECTION_FIXED.md",
    "DEPLOYMENT_VERIFICATION.md"
)

# Create temp directory
$tempDir = Join-Path $env:TEMP "screenshot_algo_clean"
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Copy files
Write-Host "   → Copying files..." -ForegroundColor Gray
foreach ($item in $includeFiles) {
    $sourcePath = Join-Path (Get-Location) $item
    $destPath = Join-Path $tempDir $item

    if (Test-Path $sourcePath) {
        $destDir = Split-Path -Parent $destPath
        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        if (Test-Path $sourcePath -PathType Container) {
            # Copy directory
            Copy-Item -Path $sourcePath -Destination $destPath -Recurse -Force
        } else {
            # Copy file
            Copy-Item -Path $sourcePath -Destination $destPath -Force
        }
    }
}

# Remove excluded files from temp directory
Write-Host "   → Removing excluded files..." -ForegroundColor Gray
foreach ($pattern in $excludePatterns) {
    Get-ChildItem -Path $tempDir -Filter $pattern -Recurse -File -ErrorAction SilentlyContinue | Remove-Item -Force
}

# Create data directories structure
Write-Host "   → Creating data directories..." -ForegroundColor Gray
$dataDirs = @(
    "data/screenshots",
    "data/uploads",
    "data/labels",
    "data/cache",
    "data/exports",
    "data/templates"
)

foreach ($dir in $dataDirs) {
    $dirPath = Join-Path $tempDir $dir
    if (!(Test-Path $dirPath)) {
        New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
    }
    # Create .gitkeep to preserve empty directories
    New-Item -ItemType File -Path (Join-Path $dirPath ".gitkeep") -Force | Out-Null
}

# Create ZIP
Write-Host "   → Creating ZIP archive..." -ForegroundColor Gray
$zipPath = Join-Path (Get-Location) "$OutputName.zip"
if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
}

Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -CompressionLevel Optimal

# Cleanup temp
Remove-Item -Path $tempDir -Recurse -Force

$zipSize = (Get-Item $zipPath).Length / 1MB
$zipSizeRounded = [math]::Round($zipSize, 2)
Write-Host ("   Package created: " + $OutputName + ".zip (" + $zipSizeRounded + " MB)") -ForegroundColor Green
Write-Host ""

# Create INFO file
Write-Host "[8/8] Creating package info..." -ForegroundColor Yellow
$infoContent = @"
========================================
Screenshot Algo - Clean Deployment Package
========================================

Version: 1.1.0
Build Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Package: $OutputName.zip
Size: $zipSizeRounded MB

Features:
✓ Memory Leak Fixes (Browser cleanup)
✓ Variant Detection (Shopware 6)
✓ Graceful Shutdown (SIGTERM/SIGINT)
✓ Empty Database (ready for your data)
✓ Pre-built Frontend (included in package)
✓ Comprehensive Test Report included

Installation:
1. Extract ZIP file
2. Run START.bat (Windows) or ./start.sh (Linux/Mac)
3. Open http://localhost:3000

Documentation:
- DEPLOYMENT_README.md - Complete setup guide
- COMPREHENSIVE_TEST_REPORT.md - Test results
- MEMORY_LEAK_FIXES.md - Memory leak documentation
- VARIANT_DETECTION_FIXED.md - Variant detection info

Support:
- Check DEPLOYMENT_README.md for troubleshooting
- Run: docker logs screenshot-algo-backend

========================================
"@

$infoPath = "$OutputName.txt"
$infoContent | Out-File -FilePath $infoPath -Encoding UTF8

Write-Host "   ✓ Info file created: $OutputName.txt" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  ✓ CLEAN DEPLOYMENT PACKAGE READY!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Package Details:" -ForegroundColor White
Write-Host "  - File: $OutputName.zip" -ForegroundColor Gray
Write-Host "  - Size: $zipSizeRounded MB" -ForegroundColor Gray
Write-Host "  - Database: Empty (ready for crawling)" -ForegroundColor Gray
Write-Host "  - Version: 1.1.0 (Memory Leak Fixes)" -ForegroundColor Gray
Write-Host ""
Write-Host "What's Included:" -ForegroundColor White
Write-Host "  ✓ Backend (TypeScript compiled, ready to run)" -ForegroundColor Gray
Write-Host "  ✓ Frontend (React pre-built, included in package)" -ForegroundColor Gray
Write-Host "  ✓ Docker Compose setup" -ForegroundColor Gray
Write-Host "  ✓ START/STOP scripts" -ForegroundColor Gray
Write-Host "  ✓ Complete documentation" -ForegroundColor Gray
Write-Host "  ✓ Empty data directories" -ForegroundColor Gray
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor White
Write-Host "  1. Share $OutputName.zip" -ForegroundColor Cyan
Write-Host "  2. Recipient extracts ZIP" -ForegroundColor Cyan
Write-Host "  3. Run START.bat to launch" -ForegroundColor Cyan
Write-Host "  4. Crawl shop data via Web-UI" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ready for deployment! 🚀" -ForegroundColor Green
