@echo off
cls
echo ================================================================
echo     Screenshot Algo - Installations-Assistent
echo
echo     Dieser Assistent richtet das System ein.
echo     Bitte warten Sie, dies kann 5-10 Minuten dauern.
echo
echo     Sie benoetigen nur Docker Desktop - sonst nichts!
echo ================================================================
echo.

REM Pruefe ob Docker Desktop installiert ist
echo [1/5] Pruefe Docker Installation...
docker --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo FEHLER: Docker Desktop ist nicht installiert!
    echo.
    echo Bitte installieren Sie Docker Desktop von:
    echo https://www.docker.com/products/docker-desktop
    echo.
    echo Nach der Installation starten Sie dieses Script erneut.
    pause
    exit /b 1
)
echo OK: Docker ist installiert
echo.

REM Pruefe ob Docker laeuft
echo [2/5] Pruefe ob Docker laeuft...
docker ps >nul 2>&1
if errorlevel 1 (
    echo.
    echo FEHLER: Docker Desktop laeuft nicht!
    echo.
    echo Bitte starten Sie Docker Desktop und warten Sie, bis es bereit ist.
    echo Starten Sie dann dieses Script erneut.
    pause
    exit /b 1
)
echo OK: Docker laeuft
echo.

REM Erstelle .env Datei
echo [3/5] Erstelle Konfigurationsdatei...
if not exist .env (
    copy .env.example .env >nul
    echo OK: .env Datei erstellt
) else (
    echo INFO: .env Datei existiert bereits
)
echo.

REM Raeume alte Container/Volumes auf
echo [4/5] Raeume alte Container auf...
docker-compose down -v 2>nul
echo      Entferne alte screenshot-algo Container...
for /f "tokens=*" %%i in ('docker ps -aq --filter "name=screenshot-algo"') do docker rm -f %%i 2>nul
echo      Entferne alte Volumes...
for /f "tokens=*" %%i in ('docker volume ls -q --filter "name=screenshot_algo"') do docker volume rm %%i 2>nul
echo OK: Alte Container entfernt
echo.

REM Baue alle Docker Images (inkl. Frontend in Docker!)
echo [5/6] Baue alle Services... (kann 5-10 Minuten dauern)
echo      Frontend und Backend werden in Docker gebaut.
echo      Dies ist nur beim ersten Mal noetig.
echo.
docker-compose --profile build build --no-cache frontend-builder
if errorlevel 1 (
    echo.
    echo FEHLER: Frontend-Build fehlgeschlagen
    pause
    exit /b 1
)
docker-compose --profile build up -d frontend-builder
if errorlevel 1 (
    echo.
    echo FEHLER: Frontend-Build fehlgeschlagen
    pause
    exit /b 1
)
echo OK: Frontend gebaut
echo.
docker-compose build --no-cache backend
if errorlevel 1 (
    echo.
    echo FEHLER: Backend-Build fehlgeschlagen
    pause
    exit /b 1
)
echo OK: Backend gebaut
echo.

REM Starte Services und initialisiere Datenbank
echo [6/6] Starte Services und initialisiere Datenbank...
docker-compose up -d postgres redis
echo      Warte 15 Sekunden bis Datenbank bereit ist...
timeout /t 15 /nobreak >nul
docker-compose run --rm backend npx prisma migrate deploy
if errorlevel 1 (
    echo WARNUNG: Datenbank-Migration fehlgeschlagen
    echo Sie koennen dies spaeter mit diesem Befehl nachholen:
    echo docker-compose run --rm backend npx prisma migrate deploy
)
echo OK: Datenbank initialisiert
echo.

echo ================================================================
echo              INSTALLATION ABGESCHLOSSEN
echo ================================================================
echo.
echo Was wurde installiert:
echo    - PostgreSQL Datenbank
echo    - Redis Cache
echo    - Backend API Server
echo    - Frontend (wird vom Backend ausgeliefert)
echo.
echo Naechste Schritte:
echo    1. Doppelklicken Sie auf START.bat
echo    2. Ihr Browser oeffnet sich automatisch
echo    3. Viel Spass mit Screenshot Algo!
echo.
echo TIPP: Sie brauchen NICHTS ausser Docker Desktop!
echo       Kein Node.js, kein npm, kein Python - alles laeuft in Docker.
echo.
pause
