@echo off
:: =============================================
:: BLOCK MICROSOFT EDGE AUTO-INSTALL
:: Run this script as Administrator
:: =============================================
echo.
echo =============================================
echo   BLOCKING EDGE AUTO-INSTALL
echo =============================================
echo.

:: Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script requires Administrator privileges!
    echo Right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo [1/4] Importing registry keys...
reg import "%~dp0block-edge-reinstall.reg"
if %errorLevel% equ 0 (
    echo   [OK] Registry keys imported successfully
) else (
    echo   [WARN] Some registry keys may have failed
)

echo.
echo [2/4] Stopping Edge update services...
net stop edgeupdate >nul 2>&1
net stop edgeupdatem >nul 2>&1
net stop MicrosoftEdgeElevationService >nul 2>&1
echo   [OK] Services stopped

echo.
echo [3/4] Disabling Edge update services...
sc config edgeupdate start= disabled >nul 2>&1
sc config edgeupdatem start= disabled >nul 2>&1
sc config MicrosoftEdgeElevationService start= disabled >nul 2>&1
echo   [OK] Services disabled

echo.
echo [4/4] Verifying...
echo.

echo --- Registry Verification ---
reg query "HKLM\SOFTWARE\Microsoft\EdgeUpdate" /v DoNotUpdateToEdgeWithChromium 2>nul
if %errorLevel% equ 0 (echo   [OK] DoNotUpdateToEdgeWithChromium = 1) else (echo   [FAIL] DoNotUpdateToEdgeWithChromium)

reg query "HKLM\SOFTWARE\Policies\Microsoft\EdgeUpdate" /v UpdateDefault 2>nul
if %errorLevel% equ 0 (echo   [OK] UpdateDefault = 0) else (echo   [FAIL] UpdateDefault)

reg query "HKLM\SOFTWARE\Policies\Microsoft\EdgeUpdate" /v AllowEdgeReinstall 2>nul
if %errorLevel% equ 0 (echo   [OK] AllowEdgeReinstall = 0) else (echo   [FAIL] AllowEdgeReinstall)

reg query "HKLM\SOFTWARE\Policies\Microsoft\EdgeUpdate" /v InstallDefault 2>nul
if %errorLevel% equ 0 (echo   [OK] InstallDefault = 0) else (echo   [FAIL] InstallDefault)

echo.
echo --- Service Status ---
sc query edgeupdate 2>nul | findstr /i "DISABLED"
sc query edgeupdatem 2>nul | findstr /i "DISABLED"
sc query MicrosoftEdgeElevationService 2>nul | findstr /i "DISABLED"

echo.
echo =============================================
echo   COMPLETE - Edge auto-reinstall is blocked
echo =============================================
echo.
echo If Windows still reinstalls Edge, you may need to:
echo   1. Run 'sfc /scannow' in an admin command prompt
echo   2. Use Group Policy Editor (gpedit.msc) instead
echo      Computer Config ^> Admin Templates ^> Windows Components
echo      ^> Microsoft Edge ^> Block Edge installation
echo.
pause
