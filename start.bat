@echo off
chcp 65001 > nul
title AI Game Factory
cd /d "%~dp0"

rem Локальное окружение, если оно есть; иначе системный python.
if exist ".venv\Scripts\python.exe" (
    set "PY=.venv\Scripts\python.exe"
) else (
    set "PY=python"
)

echo.
echo   Запуск AI Game Factory...
echo.

%PY% -c "import fastapi, uvicorn" 2>nul
if errorlevel 1 (
    echo   Устанавливаю зависимости ^(первый запуск^)...
    %PY% -m pip install -r requirements.txt
)

%PY% run_web.py %*
if errorlevel 1 pause
