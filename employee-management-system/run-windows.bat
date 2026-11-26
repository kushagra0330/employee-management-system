@echo off
setlocal
cd /d "%~dp0"
title PeopleFlow Employee Management System

echo ==============================================
echo   PeopleFlow - Employee Management System
echo ==============================================

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not in PATH.
  echo Install Node.js LTS from https://nodejs.org/ and reopen this file.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is not available. Reinstall Node.js LTS.
  pause
  exit /b 1
)

if not exist .env (
  copy .env.example .env >nul
  echo Created .env from .env.example.
  echo Edit .env and set a private JWT_SECRET before using the app.
)

if not exist node_modules (
  echo Installing project dependencies. This requires internet access...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed. Check internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo Starting backend. Keep this window open while using PeopleFlow.
echo Browser URL: http://localhost:5000
echo If MongoDB is not running or configured, startup will fail.
start "" cmd /c "timeout /t 4 /nobreak ^>nul ^& start http://localhost:5000"
call npm run dev

echo.
echo The server has stopped. Read the error above.
pause
