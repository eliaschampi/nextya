#!/bin/bash

# NextYa Docker Management Scripts
# Usage: ./docker-scripts.sh [command]

set -e

CONTAINER_NAME="nextya_app"
COMPOSE_FILE="docker-compose.yml"

show_help() {
    echo "NextYa Docker Management Scripts"
    echo ""
    echo "Usage: ./docker-scripts.sh [command]"
    echo ""
    echo "Commands:"
    echo "  build         - Build the Docker images"
    echo "  up            - Start all services"
    echo "  down          - Stop all services"
    echo "  restart       - Restart all services"
    echo "  logs          - Show application logs"
    echo "  shell         - Open shell in app container"
    echo "  install [pkg] - Install npm package (e.g., install @types/node)"
    echo "  uninstall [pkg] - Uninstall npm package"
    echo "  npm [cmd]     - Run npm command in container"
    echo "  db-shell      - Connect to PostgreSQL"
    echo "  clean         - Clean up containers and volumes"
    echo "  rebuild       - Clean rebuild (no cache)"
    echo "  status        - Show container status"
    echo ""
}

case "$1" in
    "build")
        echo "🔨 Building Docker images..."
        docker-compose -f $COMPOSE_FILE build
        ;;
    
    "up")
        echo "🚀 Starting services..."
        docker-compose -f $COMPOSE_FILE up -d
        echo "✅ Services started!"
        echo "📱 App: http://localhost:5173"
        echo "🐘 PostgreSQL: localhost:5432"
        ;;
    
    "down")
        echo "🛑 Stopping services..."
        docker-compose -f $COMPOSE_FILE down
        ;;
    
    "restart")
        echo "🔄 Restarting services..."
        docker-compose -f $COMPOSE_FILE restart
        ;;
    
    "logs")
        echo "📋 Showing application logs..."
        docker-compose -f $COMPOSE_FILE logs -f app
        ;;
    
    "shell")
        echo "🐚 Opening shell in app container..."
        docker exec -it $CONTAINER_NAME /bin/sh
        ;;
    
    "install")
        if [ -z "$2" ]; then
            echo "❌ Please specify package name"
            echo "Example: ./docker-scripts.sh install @types/node"
            exit 1
        fi
        echo "📦 Installing $2..."
        docker exec -it $CONTAINER_NAME npm install "$2"
        echo "✅ Package $2 installed!"
        ;;
    
    "uninstall")
        if [ -z "$2" ]; then
            echo "❌ Please specify package name"
            exit 1
        fi
        echo "🗑️ Uninstalling $2..."
        docker exec -it $CONTAINER_NAME npm uninstall "$2"
        echo "✅ Package $2 uninstalled!"
        ;;
    
    "npm")
        if [ -z "$2" ]; then
            echo "❌ Please specify npm command"
            echo "Example: ./docker-scripts.sh npm run build"
            exit 1
        fi
        shift
        echo "📦 Running npm $@..."
        docker exec -it $CONTAINER_NAME npm "$@"
        ;;
    
    "db-shell")
        echo "🐘 Connecting to PostgreSQL..."
        docker exec -it nextya_postgres psql -U postgres -d nextya
        ;;
    
    "clean")
        echo "🧹 Cleaning up..."
        docker-compose -f $COMPOSE_FILE down -v
        docker system prune -f
        echo "✅ Cleanup complete!"
        ;;
    
    "rebuild")
        echo "🔨 Clean rebuild (no cache)..."
        docker-compose -f $COMPOSE_FILE down -v
        docker-compose -f $COMPOSE_FILE build --no-cache
        docker-compose -f $COMPOSE_FILE up -d
        echo "✅ Rebuild complete!"
        ;;
    
    "status")
        echo "📊 Container status:"
        docker-compose -f $COMPOSE_FILE ps
        ;;
    
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
