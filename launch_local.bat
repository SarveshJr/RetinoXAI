@echo off
setlocal enabledelayedexpansion
title RetinoXAI - 1-Click Launcher (SIH26038)

echo ========================================================
echo   RetinoXAI - Explainable AI for DR Screening
echo   Smart India Hackathon 2026 - Problem SIH26038
echo   Team HACK PROCESSING UNIT (SIH26-A0H-T316)
echo ========================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "FRONTEND_DIR=%SCRIPT_DIR%prototype\frontend"
set "BACKEND_DIR=%SCRIPT_DIR%prototype\backend"

:: Step 1: Ensure Frontend is installed and built
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [*] Installing frontend dependencies (one-time setup)...
    cd /d "%FRONTEND_DIR%"
    call npm install
    if errorlevel 1 (
        echo [!] npm install failed. Please check that Node.js is installed.
        pause
        exit /b 1
    )
)

if not exist "%FRONTEND_DIR%\dist\index.html" (
    echo [*] Building production frontend bundle...
    cd /d "%FRONTEND_DIR%"
    call npm run build
    if errorlevel 1 (
        echo [!] npm run build failed.
        pause
        exit /b 1
    )
)

echo.
echo Select launch mode:
echo [1] Standalone Web App (No MATLAB needed - Instant Demo Mode)
echo [2] Live MATLAB Engine + Unified Web App (Port 8080)
echo [3] Developer Mode (Vite Dev Server on Port 5173)
echo.
set /p MODE="Enter choice (1, 2, or 3) [Default 1]: "
if "%MODE%"=="" set MODE=1

if "%MODE%"=="1" (
    echo.
    echo [*] Starting Standalone Web App on http://localhost:4173 ...
    cd /d "%FRONTEND_DIR%"
    start "" http://localhost:4173
    call npx vite preview --port 4173
    goto end
)

if "%MODE%"=="2" (
    echo.
    echo [*] Checking for MATLAB...
    where matlab >nul 2>nul
    if errorlevel 1 (
        echo [!] 'matlab' command not found in system PATH.
        echo If you have MATLAB installed, add its bin directory to PATH or run:
        echo cd prototype\backend ^&^& RetinoXAIServer(8080) from inside MATLAB.
        echo.
        echo Falling back to Standalone Web App...
        cd /d "%FRONTEND_DIR%"
        start "" http://localhost:4173
        call npx vite preview --port 4173
        goto end
    )
    echo [*] Starting RetinoXAI MATLAB Server on http://localhost:8080 ...
    start "" http://localhost:8080
    matlab -nosplash -nodesktop -batch "cd('%BACKEND_DIR%'); RetinoXAIServer(8080)"
    goto end
)

if "%MODE%"=="3" (
    echo.
    echo [*] Starting Vite Dev Server on http://localhost:5173 ...
    cd /d "%FRONTEND_DIR%"
    start "" http://localhost:5173
    call npm run dev
    goto end
)

:end
pause
