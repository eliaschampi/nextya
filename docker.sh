#!/bin/bash

#=============================================================================
# Docker Management Script for NextYa
#=============================================================================
# Clean and minimal Docker operations for development environment
# Usage: ./docker.sh [command] [options]
#=============================================================================

set -e

#-----------------------------------------------------------------------------
# Configuration
#-----------------------------------------------------------------------------
readonly SCRIPT_NAME=$(basename "$0")
readonly PROJECT_NAME="nextya"
readonly COMPOSE_FILE="docker-compose.yml"

# Export user permissions for Docker volumes
export USER_ID=$(id -u)
export GROUP_ID=$(id -g)

#-----------------------------------------------------------------------------
# Output Functions
#-----------------------------------------------------------------------------
print_info() {
    echo "INFO: $1"
}

print_success() {
    echo "SUCCESS: $1"
}

print_error() {
    echo "ERROR: $1" >&2
}

print_warning() {
    echo "WARNING: $1"
}

print_header() {
    echo
    echo "=== $1 ==="
    echo
}

#-----------------------------------------------------------------------------
# Utility Functions
#-----------------------------------------------------------------------------
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"
        exit 1
    fi
}

check_compose_file() {
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        print_error "Docker Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
}

#-----------------------------------------------------------------------------
# Command Functions
#-----------------------------------------------------------------------------
cmd_build() {
    print_header "Building Docker Images"
    print_info "Building images for $PROJECT_NAME"
    docker-compose -f "$COMPOSE_FILE" build
    print_success "Build completed"
}

cmd_up() {
    print_header "Starting Services"
    print_info "Starting $PROJECT_NAME services"
    docker-compose -f "$COMPOSE_FILE" up -d
    print_success "All services are running"
    print_info "View logs with: $SCRIPT_NAME logs"
}

cmd_down() {
    print_header "Stopping Services"
    print_info "Stopping $PROJECT_NAME services"
    docker-compose -f "$COMPOSE_FILE" down
    print_success "All services stopped"
}

cmd_restart() {
    print_header "Restarting Services"
    cmd_down
    cmd_up
}

cmd_logs() {
    print_header "Viewing Logs"
    print_info "Showing logs (Ctrl+C to exit)"
    docker-compose -f "$COMPOSE_FILE" logs -f
}

cmd_shell() {
    print_header "Opening Shell"
    print_info "Connecting to app container"
    docker exec -it "${PROJECT_NAME}_app" /bin/sh
}

cmd_npm() {
    shift  # Remove the 'npm' command from arguments
    print_header "Running NPM Command"
    print_info "Executing: npm $*"
    docker exec -it "${PROJECT_NAME}_app" npm "$@"
}

cmd_db_shell() {
    print_header "Database Shell"
    print_info "Connecting to PostgreSQL"
    docker exec -it "${PROJECT_NAME}_postgres" psql -U postgres -d "$PROJECT_NAME"
}

cmd_db_migrate() {
    print_header "Database Migration"
    print_info "Running database migrations"
    docker exec -it "${PROJECT_NAME}_app" npm run db:migrate
    print_success "Migrations completed"
}

cmd_db_rollback() {
    print_header "Database Rollback"
    print_info "Rolling back last migration"
    docker exec -it "${PROJECT_NAME}_app" npm run db:rollback
    print_success "Rollback completed"
}

cmd_db_generate() {
    print_header "Generate Database Types"
    print_info "Generating TypeScript types from database schema"
    docker exec -it "${PROJECT_NAME}_app" npm run db:generate
    print_success "Types generated"
}

cmd_db_create() {
    shift  # Remove the 'db:create' command from arguments
    print_header "Create Migration"
    print_info "Creating new migration: $*"
    docker exec -it "${PROJECT_NAME}_app" npm run db:create "$@"
    print_success "Migration file created"
}

cmd_db_reset() {
    print_header "Reset Database"
    print_warning "This will destroy all data and recreate the database!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Resetting database"
        docker-compose down -v
        docker-compose up -d
        print_info "Waiting for database to be ready"
        sleep 5
        print_info "Generating types"
        docker exec -it "${PROJECT_NAME}_app" npm run db:generate
        print_success "Database reset completed"
    else
        print_info "Database reset cancelled"
    fi
}

cmd_status() {
    print_header "Service Status"
    docker-compose -f "$COMPOSE_FILE" ps
}

cmd_clean() {
    print_header "Cleanup"
    print_warning "This will remove all containers"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker rm -vf $(docker ps -aq)
        print_success "Cleanup completed"
    else
        print_info "Cleanup cancelled"
    fi
}

#-----------------------------------------------------------------------------
# Help Function
#-----------------------------------------------------------------------------
show_help() {
    cat << EOF

Docker Management Script for NextYa

Usage:
  $SCRIPT_NAME [command] [options]

Available Commands:
  build         Build Docker images
  up            Start all services in detached mode
  down          Stop all running services
  restart       Restart all services
  logs          View logs from all services
  status        Show status of all services
  shell         Open shell in app container
  npm           Run npm commands in app container
  db:shell      Open PostgreSQL shell
  db:migrate    Run database migrations
  db:rollback   Rollback last migration
  db:generate   Generate TypeScript types
  db:create     Create new migration file
  db:reset      Reset database (destroys all data)
  clean         Remove all containers
  help          Show this help message

Examples:
  $SCRIPT_NAME up                    # Start all services
  $SCRIPT_NAME npm install           # Install npm dependencies
  $SCRIPT_NAME npm run dev           # Run development server
  $SCRIPT_NAME db:migrate            # Run database migrations
  $SCRIPT_NAME db:create "name"      # Create new migration
  $SCRIPT_NAME db:reset              # Reset database

Environment:
  Project:     $PROJECT_NAME
  Compose:     $COMPOSE_FILE
  User ID:     $USER_ID
  Group ID:    $GROUP_ID

EOF
}

#-----------------------------------------------------------------------------
# Main Entry Point
#-----------------------------------------------------------------------------
main() {
    # Check prerequisites
    check_docker
    check_compose_file

    # Parse command
    case "${1:-help}" in
        "build")      cmd_build ;;
        "up")         cmd_up ;;
        "down")       cmd_down ;;
        "restart")    cmd_restart ;;
        "logs")       cmd_logs ;;
        "status")     cmd_status ;;
        "shell")      cmd_shell ;;
        "npm")        cmd_npm "$@" ;;
        "db:shell")     cmd_db_shell ;;
        "db:migrate")   cmd_db_migrate ;;
        "db:rollback")  cmd_db_rollback ;;
        "db:generate")  cmd_db_generate ;;
        "db:create")    cmd_db_create "$@" ;;
        "db:reset")     cmd_db_reset ;;
        "clean")        cmd_clean ;;
        "help"|"-h"|"--help") show_help ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"