@echo off
echo ========================================
echo FRESH INSTALL - Screenshot Algo System
echo ========================================
echo.
echo This will set up a complete system with:
echo - Docker containers
echo - Database initialization
echo - 1363 pre-loaded articles
echo.
pause

echo.
echo [1/6] Checking Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not in PATH
    echo Please install Docker Desktop first
    pause
    exit /b 1
)
echo Docker found!

echo.
echo [2/6] Setting up environment...
if not exist .env (
    copy .env.example .env
    echo Created .env file from template
) else (
    echo .env file already exists
)

echo.
echo [3/6] Starting Docker containers...
docker-compose up -d
if %errorlevel% neq 0 (
    echo ERROR: Failed to start Docker containers
    pause
    exit /b 1
)

echo.
echo [4/6] Waiting for services to be ready...
echo Waiting for backend to start (30 seconds)...
timeout /t 30 /nobreak >nul

echo.
echo [5/6] Installing dependencies...
cd backend
call npm install
cd ..

cd frontend
call npm install
cd ..

echo.
echo [6/6] Importing articles...
echo Importing 1363 articles from backup...
timeout /t 5 /nobreak >nul

node scripts\import-articles-fresh.js
if %errorlevel% neq 0 (
    echo WARNING: Could not import articles automatically
    echo You can import them manually later with:
    echo   node scripts\import-articles-fresh.js
)

echo.
echo ========================================
echo INSTALLATION COMPLETE!
echo ========================================
echo.
echo The system is now ready to use:
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3001
echo.
echo To start the system in the future, run: START.bat
echo To stop the system, run: STOP.bat
echo.
echo Articles loaded:
echo - 1039 FROM_EXCEL articles
echo - 324 SHOP_ONLY articles
echo - 236 articles need tier quantity updates
echo.
echo Tier quantities CSV: data\nachpflege-staffelmengen.csv
echo.
pause