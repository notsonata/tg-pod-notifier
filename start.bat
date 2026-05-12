@echo off
setlocal

cd /d "%~dp0"

echo Starting tg-notifier from:
echo %cd%
echo.

if not exist ".env" (
  echo [ERROR] Missing .env file.
  echo Copy .env.example to .env and fill in the required values first.
  exit /b 1
)

where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker is not installed or not available in PATH.
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker Compose is not available.
  echo Update Docker Desktop or install the Docker Compose plugin.
  exit /b 1
)

echo Building and starting containers...
docker compose up --build -d
if errorlevel 1 (
  echo.
  echo [ERROR] Docker Compose failed to start the stack.
  exit /b 1
)

echo.
echo Current container status:
docker compose ps

echo.
echo Health check URL:
echo   http://localhost:38127/health
echo.
echo Public webhook base URL:
for /f "tokens=1,* delims==" %%A in ('findstr /b /c:"PUBLIC_WEBHOOK_BASE_URL=" ".env"') do (
  echo   %%B
)

endlocal
