@echo off
echo ========================================
echo Templates und Daten zurücksetzen
echo ========================================
echo.
echo WARNUNG: Dies löscht ALLE Templates und Label-Daten!
echo.
pause

echo.
echo [1/2] Stoppe Docker-Container...
docker-compose down

echo.
echo [2/2] Lösche Daten...
if exist "backend\data\label-templates" (
    rmdir /s /q "backend\data\label-templates"
    echo ✓ Templates gelöscht
) else (
    echo ! Kein Templates-Ordner gefunden
)

if exist "backend\data\images" (
    rmdir /s /q "backend\data\images"
    echo ✓ Images gelöscht
) else (
    echo ! Kein Images-Ordner gefunden
)

echo.
echo ========================================
echo Fertig! Starten Sie jetzt Docker neu mit START.bat
echo ========================================
pause
