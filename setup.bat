@echo off
REM Tiger Backend Setup Script for Windows
REM This script sets up the entire Tiger backend development environment

echo.
echo 🐅 Tiger Backend Setup Script
echo ==============================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1 delims=v" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=1 delims=." %%i in ("%NODE_VERSION%") do set NODE_MAJOR=%%i
if %NODE_MAJOR% lss 18 (
    echo [ERROR] Node.js version 18+ is required. Current version: %NODE_VERSION%
    pause
    exit /b 1
)

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed. Please install Docker from https://www.docker.com/get-started
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker Compose is not installed. Please install Docker Compose
    pause
    exit /b 1
)

echo [SUCCESS] All requirements are met!
echo.

REM Install dependencies
echo [INFO] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [SUCCESS] Dependencies installed successfully!
echo.

REM Setup environment file
echo [INFO] Setting up environment configuration...
if not exist .env (
    copy env.example .env
    echo [SUCCESS] Environment file created from template
    echo [WARNING] Please edit .env file with your configuration
) else (
    echo [WARNING] Environment file already exists, skipping...
)
echo.

REM Start Docker services
echo [INFO] Starting Docker services (PostgreSQL, MinIO, Redis)...
docker-compose up -d db minio redis
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start Docker services
    pause
    exit /b 1
)
echo [SUCCESS] Docker services started!
echo.

REM Wait for services to be ready
echo [INFO] Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Run database migrations
echo [INFO] Running database migrations...
call npx prisma migrate dev --name init
if %errorlevel% neq 0 (
    echo [ERROR] Failed to run database migrations
    pause
    exit /b 1
)
echo [SUCCESS] Database migrations completed!
echo.

REM Seed database
echo [INFO] Seeding database...
call npm run db:seed
if %errorlevel% neq 0 (
    echo [ERROR] Failed to seed database
    pause
    exit /b 1
)
echo [SUCCESS] Database seeded successfully!
echo.

REM Build application
echo [INFO] Building application...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build application
    pause
    exit /b 1
)
echo [SUCCESS] Application built successfully!
echo.

REM Run tests
echo [INFO] Running tests...
call npm test
if %errorlevel% neq 0 (
    echo [WARNING] Some tests failed, but continuing...
)
echo [SUCCESS] Tests completed!
echo.

echo.
echo [SUCCESS] 🎉 Tiger Backend setup completed successfully!
echo.
echo [INFO] Next steps:
echo 1. Edit .env file with your configuration
echo 2. Start the development server: npm run start:dev
echo 3. Visit API documentation: http://localhost:4000/api/docs
echo 4. Access MinIO console: http://localhost:9001 (admin/admin)
echo.
echo [INFO] Default admin credentials:
echo Email: admin@tiger.com
echo Password: admin123
echo.
echo [INFO] Default test user credentials:
echo Email: user@tiger.com
echo Password: user123
echo.
pause

