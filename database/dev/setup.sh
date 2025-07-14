#!/bin/bash

# NextYa Database Setup - Unified Migration System
# Simple, clean, and efficient database initialization

set -e

echo "🚀 NextYa Database Setup - Unified System"
echo "=========================================="

# Function to check if running in Docker
is_docker_environment() {
    [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null
}

# Function to wait for database
wait_for_db() {
    echo "⏳ Waiting for database to be ready..."
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if is_docker_environment; then
            # Running inside Docker container
            if pg_isready -h postgres -U postgres >/dev/null 2>&1; then
                echo "✅ Database is ready!"
                return 0
            fi
        else
            # Running on host system
            if docker exec nextya_postgres pg_isready -U postgres >/dev/null 2>&1; then
                echo "✅ Database is ready!"
                return 0
            fi
        fi
        echo "⏳ Attempt $attempt/$max_attempts - Database not ready yet..."
        sleep 2
        ((attempt++))
    done

    echo "❌ Database failed to become ready within timeout"
    return 1
}

# Function to check if database is initialized
is_db_initialized() {
    if is_docker_environment; then
        # Running inside Docker container
        local table_count=$(psql -h postgres -U postgres -d nextya -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
    else
        # Running on host system
        local table_count=$(docker exec nextya_postgres psql -U postgres -d nextya -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
    fi
    [ "$table_count" -gt 0 ]
}

# Main setup function
setup_database() {
    if ! is_docker_environment; then
        echo "🐳 Starting Docker containers..."
        docker-compose up -d
    fi

    if ! wait_for_db; then
        echo "❌ Setup failed - database not ready"
        exit 1
    fi

    if is_db_initialized; then
        echo "✅ Database already initialized"
        echo "🔄 Generating TypeScript types..."
        npm run db:generate
        echo "✅ Setup completed - database was already initialized"
    else
        echo "🔄 Initializing database from SQL files..."
        npm run db:init
        echo "✅ Database initialized successfully!"
    fi

    echo ""
    echo "🎉 Setup completed successfully!"
    echo "================================"
    echo ""
    echo "📋 Next steps:"
    if is_docker_environment; then
        echo "  • Database is ready for development"
        echo "  • Use 'npm run db:create \"name\"' for new migrations"
        echo "  • Use 'npm run db:status' to check migration status"
    else
        echo "  • Run 'npm run dev' to start development server"
        echo "  • Use 'npm run db:create \"name\"' for new migrations"
        echo "  • Use 'npm run db:status' to check migration status"
    fi
    echo ""
}

# Reset function
reset_database() {
    echo "🔄 Resetting database..."
    docker-compose down -v
    echo "✅ Database reset completed"
    setup_database
}

# Status function
show_status() {
    echo "📊 NextYa Database Status"
    echo "========================"
    
    echo "🐳 Docker Containers:"
    docker-compose ps
    
    echo ""
    echo "🔍 Database Connection:"
    if docker exec nextya_postgres pg_isready -U postgres >/dev/null 2>&1; then
        echo "✅ Database is accessible"
        
        local table_count=$(docker exec nextya_postgres psql -U postgres -d nextya -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
        echo "📊 Tables in database: $table_count"
        
        echo ""
        echo "📋 Migration Status:"
        npm run db:status
    else
        echo "❌ Database is not accessible"
    fi
}

# Parse command line arguments
case "${1:-setup}" in
    "setup"|"init")
        setup_database
        ;;
    "reset")
        reset_database
        ;;
    "status")
        show_status
        ;;
    *)
        echo "NextYa Database Setup - Unified System"
        echo "====================================="
        echo "Usage: ./database/dev/setup.sh [command]"
        echo ""
        echo "Commands:"
        echo "  setup    Initialize database (default)"
        echo "  reset    Reset and reinitialize database"
        echo "  status   Show database and migration status"
        echo ""
        echo "Quick start:"
        echo "  ./database/dev/setup.sh        # First time setup"
        echo "  npm run dev                    # Start development"
        ;;
esac
