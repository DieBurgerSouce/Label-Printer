@echo off
echo ================================================
echo   Screenshot Algo - Create Deployment Package
echo   Version 1.1.0 - Memory Leak Fixes
echo ================================================
echo.

REM Get timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set timestamp=%datetime:~0,8%_%datetime:~8,6%

set OUTPUT_NAME=Screenshot_Algo_CLEAN_%timestamp%

echo [1/5] Stopping containers and cleaning database...
docker-compose down -v >nul 2>&1
echo    Done!
echo.

echo [2/6] Building backend...
cd backend
call npm run build >nul 2>&1
cd ..
echo    Done!
echo.

echo [3/6] Building frontend...
cd frontend
call npm run build >nul 2>&1
cd ..
echo    Done!
echo.

echo [4/6] Removing test files...
del /Q test-*.js 2>nul
del /Q analyze-*.js 2>nul
del /Q check-*.js 2>nul
del /Q compare-*.js 2>nul
del /Q crawl-*.js 2>nul
del /Q comprehensive-*.js 2>nul
echo    Done!
echo.

echo [5/6] Creating ZIP package...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'; ^
   $outputName = 'Screenshot_Algo_CLEAN_' + $timestamp; ^
   $files = @('backend','frontend','docker-compose.yml','START.bat','STOP.bat','UPDATE.bat','.env.example','README.md','DEPLOYMENT_README.md','COMPREHENSIVE_TEST_REPORT.md','MEMORY_LEAK_FIXES.md','VARIANT_DETECTION_FIXED.md'); ^
   $tempDir = Join-Path $env:TEMP 'screenshot_algo_temp'; ^
   if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force }; ^
   New-Item -ItemType Directory -Path $tempDir | Out-Null; ^
   foreach ($file in $files) { ^
     if (Test-Path $file) { ^
       Copy-Item -Path $file -Destination (Join-Path $tempDir $file) -Recurse -Force ^
     } ^
   }; ^
   Compress-Archive -Path (Join-Path $tempDir '*') -DestinationPath ($outputName + '.zip') -CompressionLevel Optimal -Force; ^
   Remove-Item -Path $tempDir -Recurse -Force; ^
   $size = [math]::Round((Get-Item ($outputName + '.zip')).Length / 1MB, 2); ^
   Write-Host ('    Package created: ' + $outputName + '.zip (' + $size + ' MB)') -ForegroundColor Green"

echo.

echo [6/6] Creating info file...
echo Screenshot Algo - Clean Deployment Package > %OUTPUT_NAME%.txt
echo Version: 1.1.0 >> %OUTPUT_NAME%.txt
echo Build Date: %date% %time% >> %OUTPUT_NAME%.txt
echo. >> %OUTPUT_NAME%.txt
echo Features: >> %OUTPUT_NAME%.txt
echo - Memory Leak Fixes ^(Browser cleanup^) >> %OUTPUT_NAME%.txt
echo - Variant Detection ^(Shopware 6^) >> %OUTPUT_NAME%.txt
echo - Graceful Shutdown ^(SIGTERM/SIGINT^) >> %OUTPUT_NAME%.txt
echo - Empty Database ^(ready for your data^) >> %OUTPUT_NAME%.txt
echo - Pre-built Frontend ^(included in package^) >> %OUTPUT_NAME%.txt
echo. >> %OUTPUT_NAME%.txt
echo Installation: >> %OUTPUT_NAME%.txt
echo 1. Extract ZIP file >> %OUTPUT_NAME%.txt
echo 2. Run START.bat >> %OUTPUT_NAME%.txt
echo 3. Open http://localhost:3000 >> %OUTPUT_NAME%.txt
echo. >> %OUTPUT_NAME%.txt
echo Documentation: See DEPLOYMENT_README.md >> %OUTPUT_NAME%.txt

echo    Done!
echo.

echo ================================================
echo   CLEAN DEPLOYMENT PACKAGE READY!
echo ================================================
echo.
echo Package: %OUTPUT_NAME%.zip
echo Database: Empty ^(ready for crawling^)
echo Version: 1.1.0 ^(Memory Leak Fixes^)
echo.
echo Next Steps:
echo 1. Share %OUTPUT_NAME%.zip
echo 2. Recipient extracts ZIP
echo 3. Run START.bat to launch
echo 4. Crawl shop data via Web-UI
echo.
echo Ready for deployment!
pause
