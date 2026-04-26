@echo off
setlocal
title Blabbercast Setup
cd /d "%~dp0"

set "CHECK_ONLY=0"
set "SKIP_PYTHON=0"
set "SKIP_PIPER=0"
set "PAUSE_ON_EXIT=1"

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="--check" set "CHECK_ONLY=1"
if /I "%~1"=="--skip-python" set "SKIP_PYTHON=1"
if /I "%~1"=="--skip-piper" set "SKIP_PIPER=1"
if /I "%~1"=="--no-pause" set "PAUSE_ON_EXIT=0"
shift
goto parse_args

:args_done

echo.
echo Blabbercast setup
echo =================
echo.

set "NODE_CMD="
if exist "%~dp0runtime\node\node.exe" (
    set "NODE_CMD=%~dp0runtime\node\node.exe"
    set "PATH=%~dp0runtime\node;%PATH%"
)
if not defined NODE_CMD (
    for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_CMD set "NODE_CMD=%%N"
)
if not defined NODE_CMD (
    echo [ERROR] Node.js 18 or newer is required.
    echo Download it from https://nodejs.org/
    goto fail
)

"%NODE_CMD%" -e "const major=Number(process.versions.node.split('.')[0]); process.exit(major>=18?0:1)"
if errorlevel 1 (
    echo [ERROR] Node.js 18 or newer is required.
    "%NODE_CMD%" --version
    goto fail
)
for /f "delims=" %%V in ('"%NODE_CMD%" --version') do set "NODE_VERSION=%%V"
echo [OK] Node.js %NODE_VERSION%

set "NPM_CMD="
if exist "%~dp0runtime\node\npm.cmd" set "NPM_CMD=%~dp0runtime\node\npm.cmd"
if not defined NPM_CMD (
    for /f "delims=" %%N in ('where npm 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%N"
)
if not defined NPM_CMD (
    echo [ERROR] npm was not found. Reinstall Node.js with npm enabled.
    goto fail
)
echo [OK] npm found

if "%CHECK_ONLY%"=="0" (
    echo.
    echo Installing Node dependencies from package-lock.json...
    if exist package-lock.json (
        call "%NPM_CMD%" ci --ignore-scripts
    ) else (
        call "%NPM_CMD%" install --ignore-scripts
    )
    if errorlevel 1 goto fail
)

if "%SKIP_PYTHON%"=="1" goto after_python

set "PY_EXE="
set "PY_ARGS="
if exist "%~dp0runtime\python\python.exe" set "PY_EXE=%~dp0runtime\python\python.exe"
if not defined PY_EXE (
    for /f "delims=" %%P in ('where py 2^>nul') do if not defined PY_EXE (
        set "PY_EXE=%%P"
        set "PY_ARGS=-3"
    )
)
if not defined PY_EXE (
    for /f "delims=" %%P in ('where python 2^>nul') do if not defined PY_EXE set "PY_EXE=%%P"
)

if not defined PY_EXE (
    echo.
    echo [WARN] Python 3.9+ was not found.
    echo        TTS engines need Python. Install it from https://www.python.org/downloads/windows/
    echo        Then rerun setup.bat.
    goto after_python
)

for /f "delims=" %%V in ('"%PY_EXE%" %PY_ARGS% --version 2^>^&1') do set "PY_VERSION=%%V"
echo [OK] %PY_VERSION%

"%PY_EXE%" %PY_ARGS% -m pip --version >nul 2>&1
if errorlevel 1 (
    if "%CHECK_ONLY%"=="1" (
        echo [WARN] pip is not available for this Python install.
    ) else (
        echo Installing pip...
        "%PY_EXE%" %PY_ARGS% -m ensurepip --upgrade
        if errorlevel 1 goto fail
    )
)

if "%CHECK_ONLY%"=="0" if exist requirements.txt (
    echo.
    echo Installing Python TTS dependencies...
    "%PY_EXE%" %PY_ARGS% -m pip install -r requirements.txt
    if errorlevel 1 goto fail
)

:after_python
if "%SKIP_PIPER%"=="1" goto after_piper

if "%CHECK_ONLY%"=="1" (
    if exist "models\piper.exe" (
        echo [OK] Piper runtime found
    ) else (
        echo [WARN] Piper runtime is missing. Run setup.bat to download it.
    )

    if exist "models\en_US-lessac-medium.onnx" if exist "models\en_US-lessac-medium.onnx.json" (
        echo [OK] Default Piper voice found
    ) else (
        echo [WARN] Default Piper voice is missing. Run setup.bat to download it.
    )
) else (
    echo.
    echo Installing Piper runtime and default voice...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-piper.ps1" -ModelsDir "%~dp0models"
    if errorlevel 1 goto fail
)

:after_piper
if "%CHECK_ONLY%"=="0" (
    if not exist "models\" mkdir "models"
    if not exist "config.local.json" if exist "config.example.json" copy /Y "config.example.json" "config.local.json" >nul
    if not exist ".env" if exist ".env.example" copy /Y ".env.example" ".env" >nul
)

echo.
:success
if "%CHECK_ONLY%"=="1" (
    echo Check complete. Run setup.bat without --check to install dependencies.
) else (
    echo Setup complete. Launch with Blabbercast.bat or npm start.
)
if "%PAUSE_ON_EXIT%"=="1" (
    echo.
    pause
)
exit /b 0

:fail
echo.
echo Setup did not complete. Review the messages above.
if "%PAUSE_ON_EXIT%"=="1" (
    echo.
    pause
)
exit /b 1
