#!/bin/bash
set -e

readonly SCRIPT_NAME=$(basename "$0")
readonly PROJECT_NAME="nextya"
readonly COMPOSE_FILE="docker-compose.yml"

export USER_ID=$(id -u)
export GROUP_ID=$(id -g)

print_info() { echo "INFO: $1"; }
print_success() { echo "SUCCESS: $1"; }
print_error() { echo "ERROR: $1" >&2; }
print_warning() { echo "WARNING: $1"; }
print_header() { echo; echo "=== $1 ==="; echo; }

check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"; exit 1
    fi
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"; exit 1
    fi
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running"; exit 1
    fi
}

check_compose_file() {
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        print_error "Docker Compose file not found: $COMPOSE_FILE"; exit 1
    fi
}

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
    cmd_down; cmd_up
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
    shift
    print_header "Running NPM Command"
    print_info "Executing: npm $*"
    docker exec -it "${PROJECT_NAME}_app" npm "$@"
}

cmd_sync() {
    print_header "Syncing node_modules"
    print_info "Copying node_modules from volume to host for VS Code..."

    # Create temp container to access the volume
    docker run --rm -d --name temp_sync -v nextya_node_modules:/app/node_modules alpine:latest sleep 30

    # Remove existing node_modules if present
    [ -d "./node_modules" ] && sudo rm -rf ./node_modules

    # Copy from volume and fix permissions
    docker cp temp_sync:/app/node_modules ./ && sudo chown -R $(id -u):$(id -g) ./node_modules

    # Cleanup
    docker stop temp_sync >/dev/null 2>&1 || true

    print_success "node_modules synced for VS Code IntelliSense"
}

cmd_db_shell() {
    print_header "Database Shell"
    print_info "Connecting to PostgreSQL"
    docker exec -it "${PROJECT_NAME}_postgres" psql -U postgres -d "$PROJECT_NAME"
}

cmd_setup() {
    print_header "Complete Database Setup"
    print_info "Setting up database with unified migration system"

    if ! docker-compose ps | grep -q "Up"; then
        print_error "Containers are not running. Please run: $SCRIPT_NAME up"; exit 1
    fi

    docker exec -it "${PROJECT_NAME}_app" bash database/dev/setup.sh
    print_success "Database setup completed"
}

cmd_setup_reset() {
    print_header "Reset Database Setup"
    print_warning "This will destroy all data and recreate the database!"
    read -p "Are you sure? (y/N) " -n 1 -r; echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Resetting database"
        docker-compose down -v
        docker-compose up -d
        print_info "Waiting for database to be ready..."
        sleep 5
        docker exec -it "${PROJECT_NAME}_app" npm run setup
        print_success "Database reset completed"
    else
        print_info "Database reset cancelled"
    fi
}

cmd_db_migrate() {
    print_header "Database Migration"
    print_info "Running database migrations"

    if ! docker-compose ps | grep -q "Up"; then
        print_error "Containers are not running. Please run: $SCRIPT_NAME up"; exit 1
    fi

    docker exec -it "${PROJECT_NAME}_app" npm run db:migrate
    print_success "Migrations completed"
}

cmd_db_rollback() {
    print_header "Database Rollback"
    print_warning "Rolling back last migration batch"

    if ! docker-compose ps | grep -q "Up"; then
        print_error "Containers are not running. Please run: $SCRIPT_NAME up"; exit 1
    fi

    docker exec -it "${PROJECT_NAME}_app" npm run db:rollback
    print_success "Rollback completed"
}

cmd_db_status() {
    print_header "Migration Status"
    print_info "Checking migration status"

    if ! docker-compose ps | grep -q "Up"; then
        print_error "Containers are not running. Please run: $SCRIPT_NAME up"; exit 1
    fi

    docker exec -it "${PROJECT_NAME}_app" npm run db:status
}

cmd_db_generate() {
    print_header "Generate Database Types"
    print_info "Generating TypeScript types from database schema"

    if ! docker-compose ps | grep -q "Up"; then
        print_error "Containers are not running. Please run: $SCRIPT_NAME up"; exit 1
    fi

    docker exec -it "${PROJECT_NAME}_app" npm run db:generate
    print_success "Types generated"
}

cmd_db_create() {
    shift
    print_header "Create Migration"

    if [ $# -eq 0 ]; then
        print_error "Migration name is required"
        print_info "Usage: $SCRIPT_NAME db:create \"migration name\""; exit 1
    fi

    print_info "Creating new migration: $*"

    if ! docker-compose ps | grep -q "Up"; then
        print_error "Containers are not running. Please run: $SCRIPT_NAME up"; exit 1
    fi

    docker exec -it "${PROJECT_NAME}_app" npm run db:create "$@"
    print_success "Migration file created"
}

cmd_status() {
    print_header "Service Status"
    docker-compose -f "$COMPOSE_FILE" ps
}

cmd_clean() {
    print_header "Cleanup"
    print_warning "This will remove all containers"
    read -p "Are you sure? (y/N) " -n 1 -r; echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker rm -vf $(docker ps -aq)
        print_success "Cleanup completed"
    else
        print_info "Cleanup cancelled"
    fi
}

show_help() {
    cat << EOF
Docker Management Script for NextYa

Usage: $SCRIPT_NAME [command] [options]

🚀 Quick Start:
  $SCRIPT_NAME build && $SCRIPT_NAME up && $SCRIPT_NAME setup

📋 Commands:
  build           Build Docker images
  up              Start all services
  down            Stop all services
  restart         Restart all services
  logs            View logs
  status          Show status
  shell           Open shell in app container
  npm             Run npm commands in app container

🗄️  Database:
  setup           Complete database setup
  setup:reset     Reset database (destroys all data)
  db:shell        Open PostgreSQL shell
  db:migrate      Run database migrations
  db:rollback     Rollback last migration batch
  db:status       Show migration status
  db:generate     Generate TypeScript types
  db:create       Create new migration file

🧹 Maintenance:
  clean           Remove all containers
  help            Show this help message

Environment: $PROJECT_NAME | $COMPOSE_FILE | UID:$USER_ID GID:$GROUP_ID
EOF
}

main() {
    check_docker
    check_compose_file

    case "${1:-help}" in
        "build")        cmd_build ;;
        "up")           cmd_up ;;
        "down")         cmd_down ;;
        "restart")      cmd_restart ;;
        "logs")         cmd_logs ;;
        "status")       cmd_status ;;
        "shell")        cmd_shell ;;
        "npm")          cmd_npm "$@" ;;
        "sync")         cmd_sync ;;
        "setup")        cmd_setup ;;
        "setup:reset")  cmd_setup_reset ;;
        "db:shell")     cmd_db_shell ;;
        "db:migrate")   cmd_db_migrate ;;
        "db:rollback")  cmd_db_rollback ;;
        "db:status")    cmd_db_status ;;
        "db:generate")  cmd_db_generate ;;
        "db:create")    cmd_db_create "$@" ;;
        "clean")        cmd_clean ;;
        "help"|"-h"|"--help") show_help ;;
        *)              print_error "Unknown command: $1"; show_help; exit 1 ;;
    esac
}

main "$@"