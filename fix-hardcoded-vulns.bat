@echo off
echo =============================================
echo  Fixing Hardcoded Vulnerability Display
echo =============================================

echo.
echo Setting environment variables to show REAL scan results...
set MOCK_WSL2=false
set ENABLE_ODC=true

echo.
echo Environment Variables Set:
echo   MOCK_WSL2=%MOCK_WSL2%
echo   ENABLE_ODC=%ENABLE_ODC%

echo.
echo Stopping existing backend processes...
taskkill /f /im node.exe >nul 2>&1

echo.
echo Starting backend with correct environment...
cd backend
npm start

echo.
echo =============================================
echo  Backend started with real scan mode!
echo  - MOCK_WSL2=false (disables mock data)
echo  - ENABLE_ODC=true (enables OWASP Dependency Check)
echo =============================================
