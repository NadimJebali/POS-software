@echo off
title POS Software - Publish an Update
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run this tool. Install it from https://nodejs.org
  echo.
  pause
  exit /b 1
)
node "tools\publish-tool.mjs"
