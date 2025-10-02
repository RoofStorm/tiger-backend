#!/bin/bash

# Tiger Backend Setup Script
# This script sets up the entire Tiger backend development environment

set -e

echo "🐅 Tiger Backend Setup Script"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker from https://www.docker.com/get-started"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose"
        exit 1
    fi
    
    print_success "All requirements are met!"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm install
    print_success "Dependencies installed successfully!"
}

# Setup environment file
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f .env ]; then
        cp env.example .env
        print_success "Environment file created from template"
        print_warning "Please edit .env file with your configuration"
    else
        print_warning "Environment file already exists, skipping..."
    fi
}

# Start Docker services
start_docker_services() {
    print_status "Starting Docker services (PostgreSQL, MinIO, Redis)..."
    docker-compose up -d db minio redis
    print_success "Docker services started!"
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 10
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    npx prisma migrate dev --name init
    print_success "Database migrations completed!"
}

# Seed database
seed_database() {
    print_status "Seeding database..."
    npm run db:seed
    print_success "Database seeded successfully!"
}

# Build application
build_application() {
    print_status "Building application..."
    npm run build
    print_success "Application built successfully!"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    npm test
    print_success "Tests completed!"
}

# Main setup function
main() {
    echo
    print_status "Starting Tiger Backend setup..."
    echo
    
    check_requirements
    install_dependencies
    setup_environment
    start_docker_services
    run_migrations
    seed_database
    build_application
    run_tests
    
    echo
    print_success "🎉 Tiger Backend setup completed successfully!"
    echo
    print_status "Next steps:"
    echo "1. Edit .env file with your configuration"
    echo "2. Start the development server: npm run start:dev"
    echo "3. Visit API documentation: http://localhost:4000/api/docs"
    echo "4. Access MinIO console: http://localhost:9001 (admin/admin)"
    echo
    print_status "Default admin credentials:"
    echo "Email: admin@tiger.com"
    echo "Password: admin123"
    echo
    print_status "Default test user credentials:"
    echo "Email: user@tiger.com"
    echo "Password: user123"
    echo
}

# Run main function
main "$@"

