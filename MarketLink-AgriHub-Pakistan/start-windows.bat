@echo off
title MarketLink Agri-Hub Pakistan
cd /d "%~dp0"
echo ============================================================
echo    MarketLink Agri-Hub Pakistan - Local Server
echo    Keep this window OPEN while using the website.
echo ============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js is not installed.
  echo Download the LTS version from https://nodejs.org , install it,
  echo then double-click this file again.
  start "" https://nodejs.org
  pause
  exit /b 1
)

node scripts\serve.cjs %*
echo.
echo Server stopped.
pause
