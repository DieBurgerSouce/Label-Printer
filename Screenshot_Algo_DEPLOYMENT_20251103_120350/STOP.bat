@echo off
cls
echo ================================================================
echo          Screenshot Algo wird beendet...
echo ================================================================
echo.

REM Stoppe alle Services
echo Stoppe Services...
docker-compose down

echo.
echo ================================================================
echo              SYSTEM WURDE BEENDET
echo ================================================================
echo.
echo TIPP: Ihre Daten bleiben erhalten.
echo       Zum Neustart fuehren Sie START.bat aus.
echo.
pause
