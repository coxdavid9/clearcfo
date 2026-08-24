@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing ClearCFO dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting ClearCFO...
call npm run dev
pause
