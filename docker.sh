#!/bin/bash

# 🐳 NextYa Docker Management Script
# Unified script for all Docker operations in the NextYa project
# Usage: ./docker.sh [command] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_NAME="nextya"
APP_CONTAINER="${PROJECT_NAME}_app"
DB_CONTAINER="${PROJECT_NAME}_postgres"
COMPOSE_FILE="docker-compose.yml"

# Set environment variables for user mapping
export USER_ID=$(id -u)
export GROUP_ID=$(id -g)

# Helper functions
print_header() {
    echo -e "${PURPLE}🚀 NextYa Docker Manager${NC}"
    echo -e "${CYAN}================================${NC}"
}

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

print_step() {
    echo -e "${CYAN}🔄 $1${NC}"
}

# Check if Docker and Docker Compose are available
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
}

# Check if containers are running
check_containers() {
    if ! docker ps | grep -q $APP_CONTAINER; then
        print_warning "App container is not running"
        return 1
    fi
    return 0
}

# Show help
show_help() {
    print_header
    echo ""
    echo -e "${YELLOW}Usage:${NC} ./docker.sh [command] [options]"
    echo ""
    echo -e "${YELLOW}🏗️  Build & Setup:${NC}"
    echo "  build              Build Docker images"
    echo "  rebuild            Clean rebuild (no cache)"
    echo "  setup              Initial project setup (build + migrate + generate)"
    echo ""
    echo -e "${YELLOW}🚀 Service Management:${NC}"
    echo "  up                 Start all services"
    echo "  down               Stop all services"
    echo "  restart            Restart all services"
    echo "  status             Show service status"
    echo ""
    echo -e "${YELLOW}📊 Monitoring & Logs:${NC}"
    echo "  logs [service]     Show logs (app, postgres, or all)"
    echo "  logs:follow        Follow logs in real-time"
    echo "  ps                 Show running containers"
    echo ""
    echo -e "${YELLOW}🛠️  Development:${NC}"
    echo "  shell              Open shell in app container"
    echo "  shell:root         Open root shell in app container"
    echo "  npm <command>      Run npm command in container"
    echo "  check              Run TypeScript type checking"
    echo "  test               Run all tests (format, lint, check)"
    echo "  dev                Start development server"
    echo ""
    echo -e "${YELLOW}🗄️  Database:${NC}"
    echo "  db:shell           Open PostgreSQL shell"
    echo "  db:migrate         Run database migrations"
    echo "  db:generate        Generate TypeScript types from database"
    echo "  db:reset           Reset database (drop + migrate)"
    echo "  db:backup          Create database backup"
    echo "  db:restore <file>  Restore database from backup"
    echo ""
    echo -e "${YELLOW}📦 Package Management:${NC}"
    echo "  install <package>  Install npm package"
    echo "  uninstall <pkg>    Uninstall npm package"
    echo ""
    echo -e "${YELLOW}🧹 Maintenance:${NC}"
    echo "  clean              Remove containers and volumes"
    echo "  clean:all          Remove everything (containers, volumes, images)"
    echo "  update             Update dependencies"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  ./docker.sh setup                    # Initial project setup"
    echo "  ./docker.sh up                       # Start development environment"
    echo "  ./docker.sh logs app                 # Show app logs"
    echo "  ./docker.sh npm run build            # Build the application"
    echo "  ./docker.sh install @types/node      # Install a package"
    echo "  ./docker.sh db:generate              # Regenerate database types"
    echo ""
}

# Build commands
cmd_build() {
    print_step "Building Docker images..."
    docker-compose -f $COMPOSE_FILE build
    print_success "Build completed!"
}

cmd_rebuild() {
    print_step "Clean rebuild (no cache)..."
    docker-compose -f $COMPOSE_FILE build --no-cache
    print_success "Rebuild completed!"
}

cmd_setup() {
    print_header
    print_step "Setting up NextYa development environment..."
    
    print_info "Step 1: Building containers..."
    cmd_build
    
    print_info "Step 2: Starting services..."
    cmd_up
    
    print_info "Step 3: Waiting for database..."
    sleep 5
    
    print_info "Step 4: Running migrations..."
    cmd_db_migrate
    
    print_info "Step 5: Generating types..."
    cmd_db_generate
    
    print_success "Setup completed! 🎉"
    print_info "App: http://localhost:5173"
    print_info "Database: localhost:5432"
}

# Service management
cmd_up() {
    print_step "Starting services..."
    docker-compose -f $COMPOSE_FILE up -d
    print_success "Services started!"
    print_info "App: http://localhost:5173"
    print_info "Database: localhost:5432"
}

cmd_down() {
    print_step "Stopping services..."
    docker-compose -f $COMPOSE_FILE down
    print_success "Services stopped!"
}

cmd_restart() {
    print_step "Restarting services..."
    docker-compose -f $COMPOSE_FILE restart
    print_success "Services restarted!"
}

cmd_status() {
    print_info "Service status:"
    docker-compose -f $COMPOSE_FILE ps
}

# Monitoring
cmd_logs() {
    local service=${1:-""}
    if [ -n "$service" ]; then
        print_info "Showing logs for $service..."
        docker-compose -f $COMPOSE_FILE logs "$service"
    else
        print_info "Showing all logs..."
        docker-compose -f $COMPOSE_FILE logs
    fi
}

cmd_logs_follow() {
    print_info "Following logs (Ctrl+C to stop)..."
    docker-compose -f $COMPOSE_FILE logs -f
}

cmd_ps() {
    print_info "Running containers:"
    docker ps --filter "name=${PROJECT_NAME}"
}

# Development
cmd_shell() {
    if ! check_containers; then
        print_error "App container is not running. Start it with: ./docker.sh up"
        exit 1
    fi
    print_info "Opening shell in app container..."
    docker exec -it $APP_CONTAINER /bin/sh
}

cmd_shell_root() {
    if ! check_containers; then
        print_error "App container is not running. Start it with: ./docker.sh up"
        exit 1
    fi
    print_info "Opening root shell in app container..."
    docker exec -it --user root $APP_CONTAINER /bin/sh
}

cmd_npm() {
    if ! check_containers; then
        print_error "App container is not running. Start it with: ./docker.sh up"
        exit 1
    fi
    shift # Remove 'npm' from arguments
    print_info "Running npm $@..."
    docker exec -it $APP_CONTAINER npm "$@"
}

cmd_check() {
    print_step "Running TypeScript type checking..."
    cmd_npm run check
}

cmd_test() {
    print_step "Running all tests..."
    cmd_npm run test
}

cmd_dev() {
    print_step "Starting development server..."
    cmd_npm run dev
}

# Database commands
cmd_db_shell() {
    if ! docker ps | grep -q $DB_CONTAINER; then
        print_error "Database container is not running. Start it with: ./docker.sh up"
        exit 1
    fi
    print_info "Opening PostgreSQL shell..."
    docker exec -it $DB_CONTAINER psql -U postgres -d nextya
}

cmd_db_migrate() {
    if ! check_containers; then
        print_error "Containers are not running. Start them with: ./docker.sh up"
        exit 1
    fi
    print_step "Running database migrations..."
    docker exec -it $APP_CONTAINER npm run migrate:up
    print_success "Migrations completed!"
}

cmd_db_generate() {
    if ! check_containers; then
        print_error "Containers are not running. Start them with: ./docker.sh up"
        exit 1
    fi
    print_step "Generating TypeScript types from database..."
    docker exec -it $APP_CONTAINER npm run db:generate
    print_success "Types generated!"
}

cmd_db_reset() {
    print_warning "This will reset the entire database!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Resetting database..."
        docker exec -it $APP_CONTAINER npm run migrate:down
        docker exec -it $APP_CONTAINER npm run migrate:up
        print_success "Database reset completed!"
    else
        print_info "Database reset cancelled."
    fi
}

cmd_db_backup() {
    local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
    print_step "Creating database backup..."
    docker exec -it $DB_CONTAINER pg_dump -U postgres nextya > "$backup_file"
    print_success "Backup created: $backup_file"
}

cmd_db_restore() {
    local backup_file="$1"
    if [ -z "$backup_file" ]; then
        print_error "Please specify backup file"
        echo "Usage: ./docker.sh db:restore <backup_file>"
        exit 1
    fi

    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        exit 1
    fi

    print_warning "This will overwrite the current database!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Restoring database from $backup_file..."
        docker exec -i $DB_CONTAINER psql -U postgres -d nextya < "$backup_file"
        print_success "Database restored!"
    else
        print_info "Database restore cancelled."
    fi
}

# Package management
cmd_install() {
    local package="$1"
    if [ -z "$package" ]; then
        print_error "Please specify package name"
        echo "Usage: ./docker.sh install <package>"
        exit 1
    fi

    if ! check_containers; then
        print_error "App container is not running. Start it with: ./docker.sh up"
        exit 1
    fi

    print_step "Installing $package..."
    docker exec -it $APP_CONTAINER npm install "$package"
    print_success "Package $package installed!"
}

cmd_uninstall() {
    local package="$1"
    if [ -z "$package" ]; then
        print_error "Please specify package name"
        echo "Usage: ./docker.sh uninstall <package>"
        exit 1
    fi

    if ! check_containers; then
        print_error "App container is not running. Start it with: ./docker.sh up"
        exit 1
    fi

    print_step "Uninstalling $package..."
    docker exec -it $APP_CONTAINER npm uninstall "$package"
    print_success "Package $package uninstalled!"
}

# Maintenance
cmd_clean() {
    print_warning "This will remove all containers and volumes!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Cleaning up containers and volumes..."
        docker-compose -f $COMPOSE_FILE down -v
        print_success "Cleanup completed!"
    else
        print_info "Cleanup cancelled."
    fi
}

cmd_clean_all() {
    print_warning "This will remove EVERYTHING (containers, volumes, images)!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Removing everything..."
        docker-compose -f $COMPOSE_FILE down -v --rmi all
        docker system prune -f
        print_success "Complete cleanup finished!"
    else
        print_info "Cleanup cancelled."
    fi
}

cmd_update() {
    print_step "Updating dependencies..."
    if check_containers; then
        docker exec -it $APP_CONTAINER npm update
    else
        print_warning "Containers not running. Starting them first..."
        cmd_up
        sleep 3
        docker exec -it $APP_CONTAINER npm update
    fi
    print_success "Dependencies updated!"
}

# Main command dispatcher
main() {
    # Check prerequisites
    check_docker

    # Handle commands
    case "$1" in
        # Build & Setup
        "build")
            cmd_build
            ;;
        "rebuild")
            cmd_rebuild
            ;;
        "setup")
            cmd_setup
            ;;

        # Service Management
        "up")
            cmd_up
            ;;
        "down")
            cmd_down
            ;;
        "restart")
            cmd_restart
            ;;
        "status")
            cmd_status
            ;;

        # Monitoring & Logs
        "logs")
            cmd_logs "$2"
            ;;
        "logs:follow")
            cmd_logs_follow
            ;;
        "ps")
            cmd_ps
            ;;

        # Development
        "shell")
            cmd_shell
            ;;
        "shell:root")
            cmd_shell_root
            ;;
        "npm")
            cmd_npm "$@"
            ;;
        "check")
            cmd_check
            ;;
        "test")
            cmd_test
            ;;
        "dev")
            cmd_dev
            ;;

        # Database
        "db:shell")
            cmd_db_shell
            ;;
        "db:migrate")
            cmd_db_migrate
            ;;
        "db:generate")
            cmd_db_generate
            ;;
        "db:reset")
            cmd_db_reset
            ;;
        "db:backup")
            cmd_db_backup
            ;;
        "db:restore")
            cmd_db_restore "$2"
            ;;

        # Package Management
        "install")
            cmd_install "$2"
            ;;
        "uninstall")
            cmd_uninstall "$2"
            ;;

        # Maintenance
        "clean")
            cmd_clean
            ;;
        "clean:all")
            cmd_clean_all
            ;;
        "update")
            cmd_update
            ;;

        # Help
        "help"|"--help"|"-h"|"")
            show_help
            ;;

        *)
            print_error "Unknown command: $1"
            echo ""
            print_info "Run './docker.sh help' for available commands"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
