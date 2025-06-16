#!/bin/bash

# Docker development helper script for NextYa

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Set environment variables
export USER_ID=$(id -u)
export GROUP_ID=$(id -g)

case "$1" in
    "build")
        print_info "Building Docker containers..."
        docker-compose build
        print_success "Build completed!"
        ;;
    
    "up")
        print_info "Starting services..."
        docker-compose up -d
        print_success "Services started!"
        print_info "App: http://localhost:5173"
        print_info "Database: localhost:5432"
        ;;
    
    "down")
        print_info "Stopping services..."
        docker-compose down
        print_success "Services stopped!"
        ;;
    
    "restart")
        print_info "Restarting services..."
        docker-compose restart
        print_success "Services restarted!"
        ;;
    
    "logs")
        if [ -n "$2" ]; then
            docker-compose logs -f "$2"
        else
            docker-compose logs -f
        fi
        ;;
    
    "shell")
        print_info "Opening shell in app container..."
        docker exec -it nextya_app /bin/sh
        ;;
    
    "db:shell")
        print_info "Opening PostgreSQL shell..."
        docker exec -it nextya_postgres psql -U postgres -d nextya
        ;;
    
    "db:generate")
        print_info "Generating database types..."
        docker exec -it nextya_app npm run db:generate
        docker cp nextya_app:/app/src/lib/database/types.ts src/lib/database/types.ts
        print_success "Types generated and copied to host!"
        ;;
    
    "migrate")
        print_info "Running database migrations..."
        docker exec -it nextya_app npm run migrate:up
        print_success "Migrations completed!"
        ;;
    
    "install")
        if [ -z "$2" ]; then
            print_error "Please specify a package name"
            exit 1
        fi
        print_info "Installing package: $2"
        ./docker-scripts.sh install "$2"
        print_success "Package $2 installed!"
        ;;
    
    "status")
        print_info "Service status:"
        docker-compose ps
        ;;
    
    "clean")
        print_warning "This will remove all containers, volumes, and images!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Cleaning up..."
            docker-compose down -v --rmi all
            print_success "Cleanup completed!"
        else
            print_info "Cleanup cancelled."
        fi
        ;;
    
    "help"|"")
        echo "NextYa Docker Development Helper"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  build              Build Docker containers"
        echo "  up                 Start all services"
        echo "  down               Stop all services"
        echo "  restart            Restart all services"
        echo "  logs [service]     Show logs (optionally for specific service)"
        echo "  shell              Open shell in app container"
        echo "  db:shell           Open PostgreSQL shell"
        echo "  db:generate        Generate TypeScript types from database"
        echo "  migrate            Run database migrations"
        echo "  install <package>  Install npm package"
        echo "  status             Show service status"
        echo "  clean              Remove all containers, volumes, and images"
        echo "  help               Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 up              # Start development environment"
        echo "  $0 logs app        # Show app logs"
        echo "  $0 install express # Install express package"
        echo "  $0 db:generate     # Regenerate database types"
        ;;
    
    *)
        print_error "Unknown command: $1"
        print_info "Run '$0 help' for available commands"
        exit 1
        ;;
esac
