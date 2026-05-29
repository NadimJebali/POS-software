@echo off
title POS Software - License Generator
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run this tool. Install it from https://nodejs.org
  echo.
  pause
  exit /b 1
)
node "tools\license-tool.cjs"
