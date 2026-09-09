@echo off
title DeckVault
cd /d "%~dp0"

echo ========================================
echo   DeckVault - TCG Collection Manager
echo ========================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install Node.js 20+ from https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=1 delims=v" %%i in ('node -v') do set NODE_MAJOR=%%i
set NODE_MAJOR=%NODE_MAJOR:v=%
if %NODE_MAJOR% lss 20 (
    echo [ERROR] Node.js 20+ required. Found: 
    node -v
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

if not exist ".env.local" (
    echo [WARNING] .env.local not found.
    echo Running in Demo Mode. Copy .env.local.example to configure Supabase.
    echo.
)

echo Starting DeckVault server...

REM Kill any leftover process on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>nul

REM Clear stale Next.js cache (fixes 500 errors on OneDrive folders)
if exist ".next" rmdir /s /q ".next" 2>nul

start /b cmd /c "npm run dev > deckvault.log 2>&1"

echo Waiting for server...
set /a count=0
:waitloop
timeout /t 1 /nobreak >nul
set /a count+=1
curl -s http://localhost:3000 >nul 2>nul
if %ERRORLEVEL% equ 0 goto serverready
if %count% geq 60 (
    echo [ERROR] Server did not start within 60 seconds.
    echo Check deckvault.log for details.
    pause
    exit /b 1
)
goto waitloop

:serverready
echo Server ready! Opening browser...
start http://localhost:3000/collection

echo.
echo DeckVault is running at http://localhost:3000
echo Press any key to stop the server...
pause >nul

echo Stopping server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>nul
echo Done.
