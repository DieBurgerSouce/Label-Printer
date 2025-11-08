$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$zipName = "Screenshot_Algo_FULL_BACKUP_$timestamp.zip"
$sourceDir = Get-Location
$tempDir = "$env:TEMP\Screenshot_Algo_Backup_$timestamp"

Write-Host "==============================================="
Write-Host "Creating FULL BACKUP of Screenshot Algo"
Write-Host "==============================================="
Write-Host ""

# Erstelle temporären Ordner
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

Write-Host "[1/4] Copying Backend..."
# Backend - exclude node_modules and dist
robocopy "backend" "$tempDir\backend" /E /XD node_modules dist .next build coverage /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

Write-Host "[2/4] Copying Frontend..."
# Frontend - exclude node_modules and dist
robocopy "frontend" "$tempDir\frontend" /E /XD node_modules dist .next build coverage /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

Write-Host "[3/4] Copying Root Files..."
# Root files - exclude node_modules and temp files
$excludeDirs = @('node_modules', '.git', 'temp', 'tmp', '.vscode')
$excludeFiles = @('*.zip', '*.log')

Get-ChildItem -Path $sourceDir -File | ForEach-Object {
    $shouldExclude = $false
    foreach ($pattern in $excludeFiles) {
        if ($_.Name -like $pattern) {
            $shouldExclude = $true
            break
        }
    }
    if (-not $shouldExclude) {
        Copy-Item $_.FullName "$tempDir\$($_.Name)" -Force
    }
}

# Copy data, docs, scripts directories if they exist
if (Test-Path "data") {
    robocopy "data" "$tempDir\data" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
}
if (Test-Path "docs") {
    robocopy "docs" "$tempDir\docs" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
}
if (Test-Path "scripts") {
    robocopy "scripts" "$tempDir\scripts" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
}

Write-Host "[4/4] Creating ZIP file..."
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipName -Force

# Clean up
Remove-Item -Recurse -Force $tempDir

# Info output
$zipFile = Get-Item $zipName
$zipSizeMB = [math]::Round($zipFile.Length / 1MB, 2)

Write-Host ""
Write-Host "==============================================="
Write-Host "  FULL BACKUP CREATED SUCCESSFULLY!"
Write-Host "==============================================="
Write-Host ""
Write-Host "File:     $zipName"
Write-Host "Size:     $zipSizeMB MB"
Write-Host "Location: $sourceDir"
Write-Host ""
Write-Host "Backup Contents:"
Write-Host "  - Complete source code (backend + frontend)"
Write-Host "  - All configuration files"
Write-Host "  - All data files"
Write-Host "  - All documentation"
Write-Host "  - All scripts"
Write-Host ""
Write-Host "NOTE: node_modules excluded (reinstall with npm install)"
Write-Host ""
