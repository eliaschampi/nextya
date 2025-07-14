#!/bin/bash

# NextYa Database Setup for Docker Environment
# This script runs inside the Docker container

set -e

echo "🐳 NextYa Database Setup - Docker Environment"
echo "============================================="

# Function to wait for database (inside Docker)
wait_for_db() {
    echo "⏳ Waiting for database to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if pg_isready -h postgres -U postgres >/dev/null 2>&1; then
            echo "✅ Database is ready!"
            return 0
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
    local table_count=$(psql -h postgres -U postgres -d nextya -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
    [ "$table_count" -gt 0 ]
}

# Main setup function for Docker
setup_database() {
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
    echo "🎉 Docker setup completed successfully!"
    echo "======================================"
    echo ""
    echo "📋 Database is ready for development"
    echo "  • Use 'npm run db:create \"name\"' for new migrations"
    echo "  • Use 'npm run db:status' to check migration status"
    echo ""
}

# Reset function for Docker
reset_database() {
    echo "🔄 Resetting database in Docker environment..."
    echo "⚠️  Note: Database volumes will be reset by Docker Compose"
    
    if ! wait_for_db; then
        echo "❌ Reset failed - database not ready"
        exit 1
    fi
    
    echo "🔄 Initializing fresh database..."
    npm run db:init
    echo "✅ Database reset and initialized successfully!"
}

# Status function for Docker
show_status() {
    echo "📊 NextYa Database Status (Docker)"
    echo "=================================="
    
    echo "🔍 Database Connection:"
    if pg_isready -h postgres -U postgres >/dev/null 2>&1; then
        echo "✅ Database is accessible"
        
        local table_count=$(psql -h postgres -U postgres -d nextya -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
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
        echo "NextYa Database Setup - Docker Environment"
        echo "========================================="
        echo "Usage: bash database/dev/docker-setup.sh [command]"
        echo ""
        echo "Commands:"
        echo "  setup    Initialize database (default)"
        echo "  reset    Reset and reinitialize database"
        echo "  status   Show database and migration status"
        echo ""
        echo "This script is designed to run inside Docker containers"
        ;;
esac
