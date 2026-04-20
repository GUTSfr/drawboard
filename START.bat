@echo off
title DrawBoard
color 0A
cd /d "%~dp0"

echo.
echo  DrawBoard - Starting...
echo  ========================
echo.

node --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  ERROR: Node.js not found!
    echo  Please install from: nodejs.org
    echo.
    pause
    exit
)

echo  [1/3] Node.js OK
echo.

echo  [2/3] Installing server...
cd "%~dp0server"
call npm install
echo  Server deps done!
echo.

echo  [3/3] Installing and building client...
cd "%~dp0client"
call npm install
call npm run build
echo  Client built!
echo.

echo  ========================
echo  Open browser:
echo  http://localhost:3001
echo  ========================
echo.

start "" "http://localhost:3001"

cd "%~dp0server"
node index.js
pause
