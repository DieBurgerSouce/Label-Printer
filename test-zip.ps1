$zipPath = 'Screenshot_Algo_20251022_034232.zip'
$tempExtract = "$env:TEMP\test_extract_zip"

if (Test-Path $tempExtract) { Remove-Item -Recurse -Force $tempExtract }
Expand-Archive -Path $zipPath -DestinationPath $tempExtract

Write-Host "Checking for package-lock.json files..."
$lockFiles = Get-ChildItem -Path $tempExtract -Recurse -Filter 'package-lock.json'

if ($lockFiles.Count -gt 0) {
    Write-Host "FOUND $($lockFiles.Count) package-lock.json files:"
    foreach ($file in $lockFiles) {
        $relativePath = $file.FullName.Replace($tempExtract, "")
        Write-Host "  - $relativePath"
    }
} else {
    Write-Host "ERROR: NO package-lock.json files found!"
}

Remove-Item -Recurse -Force $tempExtract
