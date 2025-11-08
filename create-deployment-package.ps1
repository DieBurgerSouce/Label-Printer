$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$zipName = "Screenshot_Algo_DEPLOYMENT_$timestamp.zip"
$sourceDir = Get-Location
$tempDir = "$env:TEMP\Screenshot_Algo_Deployment"

Write-Host "==============================================="
Write-Host "Creating DEPLOYMENT package for Screenshot Algo"
Write-Host "==============================================="
Write-Host ""

# Erstelle temporären Ordner
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
New-Item -ItemType Directory -Path "$tempDir\backend" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\frontend" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\data" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\scripts" -Force | Out-Null

Write-Host "[1/6] Exporting current articles from database..."
# Export articles first
node export-articles-via-api.js | Out-Null
if ($?) {
    Write-Host "  OK: Articles exported successfully"
} else {
    Write-Host "  WARNING: Could not export articles" -ForegroundColor Yellow
}

Write-Host "[2/6] Copying Backend..."
# Backend Source
robocopy "backend\src" "$tempDir\backend\src" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
robocopy "backend\prisma" "$tempDir\backend\prisma" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

# Backend Files - explicit copy
Copy-Item "backend\package.json" "$tempDir\backend\package.json" -Force
Copy-Item "backend\package-lock.json" "$tempDir\backend\package-lock.json" -Force
Copy-Item "backend\tsconfig.json" "$tempDir\backend\tsconfig.json" -Force
Copy-Item "backend\Dockerfile" "$tempDir\backend\Dockerfile" -Force
if (Test-Path "backend\.dockerignore") {
    Copy-Item "backend\.dockerignore" "$tempDir\backend\.dockerignore" -Force
}

Write-Host "[3/6] Building and Copying Frontend..."
# Build frontend first!
Push-Location frontend
Write-Host "  - Installing frontend dependencies..."
npm install --silent 2>&1 | Out-Null
Write-Host "  - Building frontend (this may take a moment)..."
npm run build 2>&1 | Out-Null
Pop-Location

# Frontend Source
robocopy "frontend\src" "$tempDir\frontend\src" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if (Test-Path "frontend\public") {
    robocopy "frontend\public" "$tempDir\frontend\public" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
}
# CRITICAL: Copy the built dist folder!
if (Test-Path "frontend\dist") {
    robocopy "frontend\dist" "$tempDir\frontend\dist" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    Write-Host "  OK: Frontend build included (dist/)" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Frontend dist/ folder missing!" -ForegroundColor Red
}

# Frontend Files - explicit copy
Copy-Item "frontend\package.json" "$tempDir\frontend\package.json" -Force
Copy-Item "frontend\package-lock.json" "$tempDir\frontend\package-lock.json" -Force
Copy-Item "frontend\tsconfig.json" "$tempDir\frontend\tsconfig.json" -Force
if (Test-Path "frontend\tsconfig.node.json") {
    Copy-Item "frontend\tsconfig.node.json" "$tempDir\frontend\tsconfig.node.json" -Force
}
if (Test-Path "frontend\tsconfig.app.json") {
    Copy-Item "frontend\tsconfig.app.json" "$tempDir\frontend\tsconfig.app.json" -Force
}
Copy-Item "frontend\vite.config.ts" "$tempDir\frontend\vite.config.ts" -Force
Copy-Item "frontend\index.html" "$tempDir\frontend\index.html" -Force
Copy-Item "frontend\Dockerfile" "$tempDir\frontend\Dockerfile" -Force
if (Test-Path "frontend\.dockerignore") {
    Copy-Item "frontend\.dockerignore" "$tempDir\frontend\.dockerignore" -Force
}
if (Test-Path "frontend\tailwind.config.js") {
    Copy-Item "frontend\tailwind.config.js" "$tempDir\frontend\tailwind.config.js" -Force
}
if (Test-Path "frontend\postcss.config.js") {
    Copy-Item "frontend\postcss.config.js" "$tempDir\frontend\postcss.config.js" -Force
}

Write-Host "[4/6] Copying Data and Import Scripts..."
# Copy data directory with articles export
if (Test-Path "data") {
    Copy-Item "data\articles-export.json" "$tempDir\data\articles-export.json" -Force
    Copy-Item "data\export-summary.json" "$tempDir\data\export-summary.json" -Force
    if (Test-Path "data\nachpflege-staffelmengen.csv") {
        Copy-Item "data\nachpflege-staffelmengen.csv" "$tempDir\data\nachpflege-staffelmengen.csv" -Force
        Write-Host "  OK: Including tier quantities CSV"
    }
}

# Copy scripts directory
if (Test-Path "scripts") {
    Copy-Item "scripts\import-articles-fresh.js" "$tempDir\scripts\import-articles-fresh.js" -Force
    Copy-Item "scripts\update-tier-quantities.js" "$tempDir\scripts\update-tier-quantities.js" -Force
}

Write-Host "[5/6] Copying Configuration & Installation Scripts..."
# Root files
Copy-Item "docker-compose.yml" "$tempDir\docker-compose.yml" -Force
Copy-Item ".env.example" "$tempDir\.env.example" -Force
Copy-Item "README.md" "$tempDir\README.md" -Force
if (Test-Path "ANLEITUNG_FÜR_WINDOWS.md") {
    Copy-Item "ANLEITUNG_FÜR_WINDOWS.md" "$tempDir\ANLEITUNG_FÜR_WINDOWS.md" -Force
}

# Installation scripts
Copy-Item "INSTALL.bat" "$tempDir\INSTALL.bat" -Force
Copy-Item "START.bat" "$tempDir\START.bat" -Force
Copy-Item "STOP.bat" "$tempDir\STOP.bat" -Force
Copy-Item "UPDATE.bat" "$tempDir\UPDATE.bat" -Force
Copy-Item "FRESH_INSTALL.bat" "$tempDir\FRESH_INSTALL.bat" -Force

# Copy deployment documentation if exists
if (Test-Path "DEPLOYMENT_GUIDE.md") {
    Copy-Item "DEPLOYMENT_GUIDE.md" "$tempDir\DEPLOYMENT_GUIDE.md" -Force
}
if (Test-Path "IMPORT_ERFOLGREICH_ABGESCHLOSSEN.md") {
    Copy-Item "IMPORT_ERFOLGREICH_ABGESCHLOSSEN.md" "$tempDir\IMPORT_ERFOLGREICH_ABGESCHLOSSEN.md" -Force
}

# Create required data directories
New-Item -ItemType Directory -Path "$tempDir\backend\data\screenshots" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\backend\data\labels" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\backend\data\cache" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\backend\data\exports" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\backend\data\templates" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\backend\data\label-templates" -Force | Out-Null

# Verify critical files
Write-Host ""
Write-Host "Verifying critical files..."
$criticalFiles = @(
    "$tempDir\frontend\package-lock.json",
    "$tempDir\backend\package-lock.json",
    "$tempDir\data\articles-export.json",
    "$tempDir\scripts\import-articles-fresh.js",
    "$tempDir\FRESH_INSTALL.bat"
)

$allPresent = $true
foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "  OK: $([System.IO.Path]::GetFileName($file))" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: $([System.IO.Path]::GetFileName($file)) MISSING!" -ForegroundColor Red
        $allPresent = $false
    }
}

if (-not $allPresent) {
    Write-Host ""
    Write-Host "WARNING: Some critical files are missing!" -ForegroundColor Yellow
    Write-Host "The package will still be created but may not work properly." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[6/6] Creating ZIP file..."
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipName -Force

# Clean up
Remove-Item -Recurse -Force $tempDir

# Info output
$zipFile = Get-Item $zipName
$zipSizeMB = [math]::Round($zipFile.Length / 1MB, 2)

# Count articles in export
$articlesCount = 0
if (Test-Path "data\export-summary.json") {
    $summary = Get-Content "data\export-summary.json" | ConvertFrom-Json
    $articlesCount = $summary.statistics.total
}

Write-Host ""
Write-Host "==============================================="
Write-Host "  DEPLOYMENT PACKAGE CREATED SUCCESSFULLY!"
Write-Host "==============================================="
Write-Host ""
Write-Host "File:     $zipName"
Write-Host "Size:     $zipSizeMB MB"
Write-Host "Location: $sourceDir"
Write-Host ""
Write-Host "Package Contents:"
Write-Host "  - Complete system source code"
Write-Host "  - $articlesCount pre-loaded articles"
Write-Host "  - FRESH_INSTALL.bat for automated setup"
Write-Host "  - Tier quantities CSV for manual updates"
Write-Host "  - All configuration files"
Write-Host ""
Write-Host "To deploy:"
Write-Host "  1. Extract the ZIP file"
Write-Host "  2. Run FRESH_INSTALL.bat"
Write-Host "  3. System will be ready with all articles!"
Write-Host ""
Write-Host "This package is ready to distribute!"
Write-Host ""