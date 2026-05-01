@echo off
setlocal
title Blabbercast Setup
cd /d "%~dp0"

set "CHECK_ONLY=0"
set "SKIP_RUNTIMES=0"
set "FORCE_RUNTIMES=0"
set "SKIP_PYTHON=0"
set "SKIP_PIPER=0"
set "PIPER_SET=starter"
set "PIPER_SET_REQUESTED=0"
set "PAUSE_ON_EXIT=1"

:parse_args
if "%~1"=="" goto args_done
if /I "%~1"=="--check" set "CHECK_ONLY=1"
if /I "%~1"=="--skip-runtimes" set "SKIP_RUNTIMES=1"
if /I "%~1"=="--force-runtimes" set "FORCE_RUNTIMES=1"
if /I "%~1"=="--skip-python" set "SKIP_PYTHON=1"
if /I "%~1"=="--skip-piper" set "SKIP_PIPER=1"
if /I "%~1"=="--minimal-piper" (
    set "PIPER_SET=minimal"
    set "PIPER_SET_REQUESTED=1"
)
if /I "%~1"=="--starter-piper" (
    set "PIPER_SET=starter"
    set "PIPER_SET_REQUESTED=1"
)
if /I "%~1"=="--all-piper" (
    set "PIPER_SET=all"
    set "PIPER_SET_REQUESTED=1"
)
if /I "%~1"=="--no-pause" set "PAUSE_ON_EXIT=0"
shift
goto parse_args

:args_done

echo.
echo Blabbercast setup
echo =================
echo.

set "RUNTIME_CHECK_FLAG="
set "RUNTIME_FORCE_FLAG="
set "RUNTIME_PYTHON_FLAG="
if "%CHECK_ONLY%"=="1" set "RUNTIME_CHECK_FLAG=-CheckOnly"
if "%FORCE_RUNTIMES%"=="1" set "RUNTIME_FORCE_FLAG=-Force"
if "%SKIP_PYTHON%"=="1" set "RUNTIME_PYTHON_FLAG=-SkipPython"

if "%SKIP_RUNTIMES%"=="0" (
    if "%CHECK_ONLY%"=="1" (
        echo Checking app-local Node.js and Python runtimes...
    ) else (
        echo Installing app-local Node.js and Python runtimes...
    )
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-runtimes.ps1" -RuntimeDir "%~dp0runtime" %RUNTIME_CHECK_FLAG% %RUNTIME_FORCE_FLAG% %RUNTIME_PYTHON_FLAG%
    if errorlevel 1 goto fail
) else (
    echo [INFO] Skipping app-local runtime installation.
)

set "NODE_CMD="
if exist "%~dp0runtime\node\node.exe" (
    set "NODE_CMD=%~dp0runtime\node\node.exe"
    set "PATH=%~dp0runtime\node;%PATH%"
)
if not defined NODE_CMD (
    for /f "delims=" %%N in ('where node 2^>nul') do if not defined NODE_CMD set "NODE_CMD=%%N"
)
if not defined NODE_CMD (
    if "%CHECK_ONLY%"=="1" (
        echo [WARN] Node.js runtime was not found. Run setup.bat to install it.
        goto after_node
    )
    echo [ERROR] Node.js runtime was not installed and no system Node.js was found.
    echo        Run setup.bat again, or use --skip-runtimes only if Node.js is already installed.
    goto fail
)

"%NODE_CMD%" -e "const major=Number(process.versions.node.split('.')[0]); process.exit(major>=18?0:1)"
if errorlevel 1 (
    if "%CHECK_ONLY%"=="1" (
        echo [WARN] Node.js 18 or newer is required.
        "%NODE_CMD%" --version
        goto after_node
    )
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
    if "%CHECK_ONLY%"=="1" (
        echo [WARN] npm was not found. Run setup.bat to install the app-local runtime.
        goto after_node
    )
    echo [ERROR] npm was not found. Run setup.bat again to install the app-local runtime.
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

:after_node
if "%SKIP_PYTHON%"=="1" goto after_python

set "PY_EXE="
set "PY_ARGS="
if exist "%~dp0runtime\python\python.exe" set "PY_EXE=%~dp0runtime\python\python.exe"
if not defined PY_EXE (
    for /f "delims=" %%P in ('where py 2^>nul') do (
        if not defined PY_EXE (
            "%%P" -3 --version >nul 2>&1
            if not errorlevel 1 (
                set "PY_EXE=%%P"
                set "PY_ARGS=-3"
            )
        )
    )
)
if not defined PY_EXE (
    for /f "delims=" %%P in ('where python 2^>nul') do (
        if not defined PY_EXE (
            "%%P" --version >nul 2>&1
            if not errorlevel 1 set "PY_EXE=%%P"
        )
    )
)

if not defined PY_EXE (
    echo.
    if "%CHECK_ONLY%"=="1" (
        echo [WARN] Python runtime was not found. Run setup.bat to install it.
    ) else (
        echo [ERROR] Python runtime was not installed and no system Python was found.
        echo        Run setup.bat again, or use --skip-python only if you do not need Python TTS engines.
        goto fail
    )
    goto after_python
)

for /f "delims=" %%V in ('"%PY_EXE%" %PY_ARGS% --version 2^>^&1') do set "PY_VERSION=%%V"
echo [OK] %PY_VERSION%

"%PY_EXE%" %PY_ARGS% -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)"
if errorlevel 1 (
    if "%CHECK_ONLY%"=="1" (
        echo [WARN] Python 3.9 or newer is required.
        goto after_python
    )
    echo [ERROR] Python 3.9 or newer is required.
    goto fail
)

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
    "%PY_EXE%" %PY_ARGS% -m pip install --disable-pip-version-check --no-warn-script-location -r requirements.txt
    if errorlevel 1 goto fail
)

:after_python
if "%SKIP_PIPER%"=="1" goto after_piper

if "%CHECK_ONLY%"=="0" if "%PIPER_SET_REQUESTED%"=="0" (
    echo.
    echo Choose a Piper voice pack:
    echo   [1] Minimal - 1 voice, fastest download
    echo   [2] Starter - 6 English voices, recommended
    echo   [3] All     - 11 voices, largest download
    choice /C 123 /N /M "Install which voice pack? [1/2/3]: "
    if errorlevel 3 set "PIPER_SET=all"
    if errorlevel 2 if not errorlevel 3 set "PIPER_SET=starter"
    if errorlevel 1 if not errorlevel 2 set "PIPER_SET=minimal"
)

if "%CHECK_ONLY%"=="1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-piper.ps1" -ModelsDir "%~dp0models" -VoiceSet "%PIPER_SET%" -CheckOnly
) else (
    echo.
    echo Installing Piper runtime and %PIPER_SET% voice pack...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-piper.ps1" -ModelsDir "%~dp0models" -VoiceSet "%PIPER_SET%"
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
    echo Setup complete. Launch with Blabbercast.vbs or Blabbercast.bat.
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
