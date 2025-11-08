@echo off
cls
echo ================================================================
echo          Screenshot Algo - Update
echo ================================================================
echo.

echo Ziehe neueste Aenderungen...
git pull
if errorlevel 1 (
    echo FEHLER: Git Pull fehlgeschlagen
    pause
    exit /b 1
)

echo.
echo Baue Frontend in Docker...
docker-compose --profile build up --build frontend-builder

echo.
echo Baue Backend Docker Image neu...
docker-compose build backend

echo.
echo Aktualisiere Datenbank...
docker-compose up -d postgres
timeout /t 5 /nobreak >nul
docker-compose run --rm backend npx prisma migrate deploy

echo.
echo ================================================================
echo              UPDATE ABGESCHLOSSEN
echo ================================================================
echo.
echo Naechste Schritte:
echo    1. Fuehren Sie STOP.bat aus
echo    2. Fuehren Sie START.bat aus
echo.
pause
