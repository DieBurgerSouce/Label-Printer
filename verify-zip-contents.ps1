param(
    [string]$ZipPath = "Screenshot_Algo_20251022_035339.zip"
)

Write-Host "Verifying ZIP: $ZipPath"
Write-Host ""

# Extract to temp
$tempExtract = "$env:TEMP\verify_zip"
if (Test-Path $tempExtract) { Remove-Item -Recurse -Force $tempExtract }
Expand-Archive -Path $ZipPath -DestinationPath $tempExtract

# Check for package-lock.json files
Write-Host "=== Checking for package-lock.json files ==="
$lockFiles = Get-ChildItem -Path $tempExtract -Recurse -Filter "package-lock.json" -File
if ($lockFiles.Count -gt 0) {
    Write-Host "FOUND $($lockFiles.Count) files:" -ForegroundColor Green
    foreach ($file in $lockFiles) {
        $relativePath = $file.FullName.Replace($tempExtract + "\", "")
        $size = [math]::Round($file.Length / 1KB, 1)
        Write-Host "  OK: $relativePath ($size KB)" -ForegroundColor Green
    }
} else {
    Write-Host "ERROR: NO package-lock.json files found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Checking for package.json files ==="
$packageFiles = Get-ChildItem -Path $tempExtract -Recurse -Filter "package.json" -File
if ($packageFiles.Count -gt 0) {
    Write-Host "FOUND $($packageFiles.Count) files:" -ForegroundColor Green
    foreach ($file in $packageFiles) {
        $relativePath = $file.FullName.Replace($tempExtract + "\", "")
        $size = [math]::Round($file.Length / 1KB, 1)
        Write-Host "  OK: $relativePath ($size KB)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== Full frontend directory listing ==="
if (Test-Path "$tempExtract\frontend") {
    Get-ChildItem -Path "$tempExtract\frontend" -File | Select-Object Name, Length | Format-Table
} else {
    Write-Host "frontend folder not found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Full backend directory listing ==="
if (Test-Path "$tempExtract\backend") {
    Get-ChildItem -Path "$tempExtract\backend" -File | Select-Object Name, Length | Format-Table
} else {
    Write-Host "backend folder not found!" -ForegroundColor Red
}

# Cleanup
Remove-Item -Recurse -Force $tempExtract
Write-Host ""
Write-Host "Verification complete."
