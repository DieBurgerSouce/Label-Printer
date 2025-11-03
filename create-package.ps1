$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$zipName = "Screenshot_Algo_$timestamp.zip"
$sourceDir = Get-Location
$tempDir = "$env:TEMP\Screenshot_Algo_Package"

Write-Host "Creating package for Screenshot Algo..."
Write-Host ""

# Erstelle temporären Ordner
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
New-Item -ItemType Directory -Path "$tempDir\backend" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\frontend" -Force | Out-Null

Write-Host "[1/4] Kopiere Backend..."
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

Write-Host "[2/4] Kopiere Frontend..."
# Frontend Source
robocopy "frontend\src" "$tempDir\frontend\src" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if (Test-Path "frontend\public") {
    robocopy "frontend\public" "$tempDir\frontend\public" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
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

Write-Host "[3/4] Kopiere Konfiguration & Scripts..."
# Root files
Copy-Item "docker-compose.yml" "$tempDir\docker-compose.yml" -Force
Copy-Item ".env.example" "$tempDir\.env.example" -Force
Copy-Item "README.md" "$tempDir\README.md" -Force
if (Test-Path "ANLEITUNG_FÜR_WINDOWS.md") {
    Copy-Item "ANLEITUNG_FÜR_WINDOWS.md" "$tempDir\ANLEITUNG_FÜR_WINDOWS.md" -Force
}
Copy-Item "INSTALL.bat" "$tempDir\INSTALL.bat" -Force
Copy-Item "START.bat" "$tempDir\START.bat" -Force
Copy-Item "STOP.bat" "$tempDir\STOP.bat" -Force
Copy-Item "UPDATE.bat" "$tempDir\UPDATE.bat" -Force

# Erstelle leere data Ordner
New-Item -ItemType Directory -Path "$tempDir\backend\data\screenshots" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\backend\data\labels" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\backend\data\cache" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\backend\data\exports" -Force | Out-Null
New-Item -ItemType Directory -Path "$tempDir\backend\data\templates" -Force | Out-Null

# Verify package-lock.json files exist
Write-Host ""
Write-Host "Verifying critical files..."
$frontendLock = Test-Path "$tempDir\frontend\package-lock.json"
$backendLock = Test-Path "$tempDir\backend\package-lock.json"

if (-not $frontendLock) {
    Write-Host "ERROR: frontend/package-lock.json missing!" -ForegroundColor Red
    exit 1
}
if (-not $backendLock) {
    Write-Host "ERROR: backend/package-lock.json missing!" -ForegroundColor Red
    exit 1
}
Write-Host "OK: All package-lock.json files present" -ForegroundColor Green

Write-Host ""
Write-Host "[4/4] Erstelle ZIP-Datei..."
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipName -Force

# Aufräumen
Remove-Item -Recurse -Force $tempDir

# Info ausgeben
$zipFile = Get-Item $zipName
$zipSizeMB = [math]::Round($zipFile.Length / 1MB, 2)

Write-Host ""
Write-Host "================================================"
Write-Host "  ZIP-PAKET ERFOLGREICH ERSTELLT!"
Write-Host "================================================"
Write-Host ""
Write-Host "Datei:   $zipName"
Write-Host "Groesse: $zipSizeMB MB"
Write-Host "Ort:     $sourceDir"
Write-Host ""
Write-Host "Diese Datei kann jetzt verschickt werden!"
Write-Host ""
