@echo off
setlocal EnableDelayedExpansion

set OUTPUT=docs\source_controllers.md

if not exist docs mkdir docs
if exist "%OUTPUT%" del /f /q "%OUTPUT%"

echo # Codigo Fuente Consolidado > "%OUTPUT%"
echo. >> "%OUTPUT%"

call :ProcessFolder "src\controllers"
call :ProcessFolder "src\policies"
call :ProcessFolder "src\routes"

echo.
echo Archivo generado: %OUTPUT%
exit /b

:ProcessFolder

for /r %~1 %%F in (*.ts *.js *.ejs *.css *.json) do (

  set SKIP=0

  echo %%F | findstr /i "\\vendor\\" >nul
  if not errorlevel 1 set SKIP=1

  if /i "%%~nxF"=="output.css" set SKIP=1

  if !SKIP!==0 (

    echo --- >> "%OUTPUT%"
    echo. >> "%OUTPUT%"

    echo ```text>> "%OUTPUT%"
    echo FILE: %%F>> "%OUTPUT%"
    echo ```>> "%OUTPUT%"
    echo. >> "%OUTPUT%"

    set EXT=%%~xF
    set EXT=!EXT:~1!

    echo ```!EXT!>> "%OUTPUT%"
    type "%%F" >> "%OUTPUT%"
    echo. >> "%OUTPUT%"
    echo ```>> "%OUTPUT%"
    echo. >> "%OUTPUT%"

  )
)

exit /b