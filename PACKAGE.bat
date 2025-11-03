@echo off
setlocal enabledelayedexpansion

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║           SCREENSHOT ALGO - PACKAGE CREATOR                  ║
echo ║                                                              ║
echo ║     Erstellt eine saubere ZIP-Datei zum Versand              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM Erstelle Timestamp für Dateiname
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%

set PACKAGE_NAME=Screenshot_Algo_%TIMESTAMP%
set TEMP_DIR=%TEMP%\%PACKAGE_NAME%
set OUTPUT_ZIP=%CD%\%PACKAGE_NAME%.zip

echo [1/5] Erstelle temporären Ordner...
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"
echo ✅ Temporärer Ordner erstellt: %TEMP_DIR%
echo.

echo [2/5] Kopiere wichtige Dateien...
echo      (node_modules, .git, dist werden übersprungen)
echo.

REM Erstelle Hauptordner-Struktur
mkdir "%TEMP_DIR%\backend"
mkdir "%TEMP_DIR%\frontend"

REM Kopiere Backend (ohne node_modules, dist, data)
echo    → Backend...
xcopy /E /I /Q /EXCLUDE:package_exclude.txt "backend\src" "%TEMP_DIR%\backend\src" >nul
xcopy /E /I /Q "backend\prisma" "%TEMP_DIR%\backend\prisma" >nul
copy "backend\package*.json" "%TEMP_DIR%\backend\" >nul
copy "backend\tsconfig.json" "%TEMP_DIR%\backend\" >nul
copy "backend\Dockerfile" "%TEMP_DIR%\backend\" >nul
copy "backend\.dockerignore" "%TEMP_DIR%\backend\" >nul 2>nul

REM Kopiere Frontend (ohne node_modules, dist)
echo    → Frontend...
xcopy /E /I /Q "frontend\src" "%TEMP_DIR%\frontend\src" >nul
xcopy /E /I /Q "frontend\public" "%TEMP_DIR%\frontend\public" >nul 2>nul
copy "frontend\package*.json" "%TEMP_DIR%\frontend\" >nul
copy "frontend\tsconfig*.json" "%TEMP_DIR%\frontend\" >nul
copy "frontend\vite.config.ts" "%TEMP_DIR%\frontend\" >nul
copy "frontend\index.html" "%TEMP_DIR%\frontend\" >nul
copy "frontend\Dockerfile" "%TEMP_DIR%\frontend\" >nul
copy "frontend\.dockerignore" "%TEMP_DIR%\frontend\" >nul 2>nul

REM Kopiere Root-Dateien
echo    → Konfigurationsdateien...
copy "docker-compose.yml" "%TEMP_DIR%\" >nul
copy ".env.example" "%TEMP_DIR%\" >nul
copy "README.md" "%TEMP_DIR%\" >nul
copy "ANLEITUNG_FÜR_WINDOWS.md" "%TEMP_DIR%\" >nul 2>nul

REM Kopiere BAT-Dateien
echo    → Installation Scripts...
copy "INSTALL.bat" "%TEMP_DIR%\" >nul
copy "START.bat" "%TEMP_DIR%\" >nul
copy "STOP.bat" "%TEMP_DIR%\" >nul
copy "UPDATE.bat" "%TEMP_DIR%\" >nul

echo ✅ Dateien kopiert
echo.

echo [3/5] Erstelle leere Daten-Ordner...
mkdir "%TEMP_DIR%\backend\data"
mkdir "%TEMP_DIR%\backend\data\screenshots"
mkdir "%TEMP_DIR%\backend\data\labels"
mkdir "%TEMP_DIR%\backend\data\cache"
mkdir "%TEMP_DIR%\backend\data\exports"
mkdir "%TEMP_DIR%\backend\data\templates"
echo ✅ Daten-Ordner erstellt
echo.

echo [4/5] Erstelle ZIP-Datei...
echo      Dies kann 1-2 Minuten dauern...
powershell -command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%OUTPUT_ZIP%' -Force"
if errorlevel 1 (
    echo ❌ FEHLER: ZIP-Erstellung fehlgeschlagen
    rmdir /s /q "%TEMP_DIR%"
    pause
    exit /b 1
)
echo ✅ ZIP-Datei erstellt
echo.

echo [5/5] Aufräumen...
rmdir /s /q "%TEMP_DIR%"
echo ✅ Temporäre Dateien gelöscht
echo.

REM Zeige Ergebnis
for %%A in ("%OUTPUT_ZIP%") do set SIZE_BYTES=%%~zA
set /a SIZE_MB=!SIZE_BYTES! / 1048576

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    ✅ PAKET ERSTELLT!                        ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo 📦 Datei: %PACKAGE_NAME%.zip
echo 📊 Größe: ~%SIZE_MB% MB
echo 📍 Ort:   %CD%
echo.
echo 📋 Diese ZIP-Datei enthält:
echo    ✅ Kompletten Source-Code
echo    ✅ Docker-Konfiguration
echo    ✅ Installation-Scripts (.bat)
echo    ✅ Dokumentation
echo.
echo    ❌ KEINE persönlichen Daten
echo    ❌ KEINE node_modules (werden bei Installation gebaut)
echo    ❌ KEINE .env Datei (wird bei Installation erstellt)
echo.
echo 📨 Versand:
echo    → E-Mail (wenn ^< 25 MB)
echo    → WeTransfer.com (wenn ^> 25 MB)
echo    → Google Drive / Dropbox
echo.
echo 💡 Der Empfänger muss:
echo    1. ZIP entpacken
echo    2. Docker Desktop installieren (falls nicht vorhanden)
echo    3. INSTALL.bat doppelklicken
echo    4. START.bat doppelklicken
echo.
pause
