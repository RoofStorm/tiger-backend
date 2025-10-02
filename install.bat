@echo off
echo Installing Tiger Backend dependencies...
echo.

REM Clear npm cache
echo Clearing npm cache...
npm cache clean --force

REM Delete node_modules and package-lock.json if they exist
if exist node_modules (
    echo Removing existing node_modules...
    rmdir /s /q node_modules
)

if exist package-lock.json (
    echo Removing package-lock.json...
    del package-lock.json
)

REM Install dependencies
echo Installing dependencies...
npm install

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies
    echo Try running: npm install --legacy-peer-deps
    echo.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Dependencies installed successfully!
echo.
echo Next steps:
echo 1. Copy env.example to .env and configure your settings
echo 2. Start Docker services: docker-compose up -d
echo 3. Run migrations: npm run migration:generate
echo 4. Start development server: npm run start:dev
echo.
pause
