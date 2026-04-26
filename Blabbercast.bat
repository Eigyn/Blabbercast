@echo off
setlocal
title Blabbercast
cd /d "%~dp0"
set "NODE_CMD="

if exist "%~dp0runtime\node\node.exe" (
    set "NODE_CMD=%~dp0runtime\node\node.exe"
    set "PATH=%~dp0runtime\node;%PATH%"
)

if not defined NODE_CMD (
    for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_CMD set "NODE_CMD=%%N"
)
if not defined NODE_CMD (
    echo Could not find Node.js.
    echo Install Node.js 18+ from https://nodejs.org/ or run the packaged Blabbercast.exe build.
    pause
    exit /b 1
)

if not exist "%~dp0node_modules\express\package.json" (
    echo Node dependencies are missing.
    if exist "%~dp0setup.bat" (
        choice /C YN /M "Run setup.bat now"
        if errorlevel 2 exit /b 1
        call "%~dp0setup.bat" --no-pause
        if errorlevel 1 (
            echo Setup failed. Review the messages above.
            pause
            exit /b 1
        )
    ) else (
        echo Run npm install before launching from source.
        pause
        exit /b 1
    )
)

if exist "%~dp0runtime\python\python.exe" (
    set "BLABBERCAST_PYTHON=%~dp0runtime\python\python.exe"
)

for /f "tokens=5" %%p in ('netstat -aon ^| findstr /R /C:":3000 .*LISTENING"') do (
    taskkill /F /PID %%p >nul 2>&1
)

"%NODE_CMD%" --no-deprecation server.js --open
