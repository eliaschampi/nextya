#!/bin/bash

# Simplified Docker Management Script for NextYa
# Usage: ./docker.sh [command]

set -e

# Configuration
PROJECT_NAME="nextya"
COMPOSE_FILE="docker-compose.yml"
export USER_ID=$(id -u)
export GROUP_ID=$(id -g)

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Helpers
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

# Check Docker
check_docker() {
    if ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
        print_error "Docker and Docker Compose are required"
        exit 1
    fi
}

# Commands
build() { print_info "Building images..."; docker-compose -f $COMPOSE_FILE build; print_success "Build completed"; }
up() { print_info "Starting services..."; docker-compose -f $COMPOSE_FILE up -d; print_success "Services started"; }
down() { print_info "Stopping services..."; docker-compose -f $COMPOSE_FILE down; print_success "Services stopped"; }
logs() { docker-compose -f $COMPOSE_FILE logs -f; }
shell() { docker exec -it ${PROJECT_NAME}_app /bin/sh; }
npm() { shift; docker exec -it ${PROJECT_NAME}_app npm "$@"; }
db_shell() { docker exec -it ${PROJECT_NAME}_postgres psql -U postgres -d nextya; }
db_migrate() { docker exec -it ${PROJECT_NAME}_app npm run db:migrate; print_success "Migrations completed"; }

# Main
check_docker
case "$1" in
    "build") build ;;
    "up") up ;;
    "down") down ;;
    "logs") logs ;;
    "shell") shell ;;
    "npm") npm "$@" ;;
    "db:shell") db_shell ;;
    "db:migrate") db_migrate ;;
    *) echo "Usage: ./docker.sh [build|up|down|logs|shell|npm|db:shell|db:migrate]"; exit 1 ;;
esac