@echo off
setlocal

set OUTPUT=docs\source_structure.md

if not exist docs mkdir docs
if exist "%OUTPUT%" del /f /q "%OUTPUT%"

echo # Estructura del Proyecto > "%OUTPUT%"
echo.>> "%OUTPUT%"

echo ```text>> "%OUTPUT%"

for /f "delims=" %%L in ('tree src /f /a') do (
  echo %%L | findstr /i "\\vendor\\" >nul
  if errorlevel 1 (
    echo %%L>> "%OUTPUT%"
  )
)

echo ```>> "%OUTPUT%"

echo.
echo Archivo generado: %OUTPUT%

endlocal