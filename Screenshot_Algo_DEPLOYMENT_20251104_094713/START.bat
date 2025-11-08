@echo off
cls
echo ================================================================
echo          Screenshot Algo wird gestartet...
echo ================================================================
echo.

REM Pruefe ob Docker laeuft
docker ps >nul 2>&1
if errorlevel 1 (
    echo WARNUNG: Docker Desktop laeuft nicht. Versuche zu starten...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo         Bitte warten Sie 30 Sekunden, bis Docker bereit ist...
    timeout /t 30 /nobreak >nul
)

REM Starte alle Services
echo Starte Services...
docker-compose up -d

REM Warte bis Backend bereit ist
echo Warte bis Backend bereit ist...
timeout /t 10 /nobreak >nul

REM Oeffne Browser
echo Oeffne Browser...
start http://localhost:3001

echo.
echo ================================================================
echo                  SYSTEM LAEUFT!
echo ================================================================
echo.
echo Zugriff:
echo    Browser: http://localhost:3001
echo.
echo    Zum Beenden fuehren Sie STOP.bat aus
echo.
pause
