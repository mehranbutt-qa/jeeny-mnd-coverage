@echo off
echo.
echo ========================================
echo   M^&D Coverage Dashboard — Update
echo ========================================
echo.

REM Check Node is available
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Node.js not found. Install from https://nodejs.org
  pause
  exit /b 1
)

REM Set credentials (edit these once)
set TESTRAIL_URL=https://jeeny1.testrail.io
set TESTRAIL_USER=waqar.younas@jeeny.me
set TESTRAIL_API_KEY=

if "%TESTRAIL_API_KEY%"=="" (
  echo ERROR: Set your TESTRAIL_API_KEY in this file first.
  echo Open update.cmd in Notepad and fill in your API key.
  pause
  exit /b 1
)

echo [1/3] Fetching latest M^&D cases from TestRail...
node extract.js
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Fetch failed. Check your credentials.
  pause
  exit /b 1
)

echo.
echo [2/3] Rebuilding presentation...
node build.js
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Build failed.
  pause
  exit /b 1
)

echo.
echo [3/3] Pushing to GitHub...
git add all-cases-data.json smoke-cases.json regression-cases.json tier-0-cases.json tier-1-cases.json tier-2-cases.json tier-3-cases.json presentation.html index.html
git commit -m "data: refresh M&D cases from TestRail"
git push
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Git push failed. Check your internet connection.
  pause
  exit /b 1
)

echo.
echo ========================================
echo   Done! Dashboard updated.
echo   https://mehranbutt-qa.github.io/jeeny-mnd-coverage/
echo ========================================
echo.
pause
