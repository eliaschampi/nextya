#!/bin/bash

# NextYa Database Setup - Container Version
set -e

echo "🚀 NextYa Database Setup"
echo "========================"

# Check if running inside container
is_container() {
    [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null
}

# Wait for database (using Node.js connection test)
wait_for_db() {
    echo "⏳ Waiting for database..."
    local attempt=1
    while [ $attempt -le 30 ]; do
        if npm run db:check >/dev/null 2>&1; then
            echo "✅ Database ready!"
            return 0
        fi
        echo "⏳ Attempt $attempt/30..."
        sleep 2
        ((attempt++))
    done
    echo "❌ Database timeout"
    return 1
}

# Check if database has tables (using Node.js)
is_db_initialized() {
    local result=$(npm run db:check:tables 2>/dev/null | tail -1)
    [ "$result" = "true" ]
}

# Setup database (container version)
setup_database() {
    if ! is_container; then
        echo "❌ This script must run inside container"
        echo "💡 Use: ./docker.sh db:setup"
        exit 1
    fi

    if ! wait_for_db; then
        echo "❌ Setup failed"
        exit 1
    fi

    if is_db_initialized; then
        echo "✅ Database exists, generating types..."
        npm run db:generate
    else
        echo "🔄 Initializing database..."
        npm run db:init
    fi

    echo "✅ Setup complete!"
}

# Reset database (container version)
reset_database() {
    echo "❌ Reset not available from container"
    echo "💡 Use: ./docker.sh db:reset"
    exit 1
}

# Show status (container version)
show_status() {
    echo "📊 Status"
    echo "========="
    
    if npm run db:check >/dev/null 2>&1; then
        local result=$(npm run db:check:tables 2>/dev/null | tail -1)
        if [ "$result" = "true" ]; then
            echo "✅ Database: initialized"
        else
            echo "✅ Database: connected, no tables"
        fi
        npm run db:status
    else
        echo "❌ Database not accessible"
    fi
}

# Commands
case "${1:-setup}" in
    "setup"|"init") setup_database ;;
    "reset") reset_database ;;
    "status") show_status ;;
    *)
        echo "Usage: ./database/dev/setup.sh [setup|reset|status]"
        echo "  setup  - Initialize database (default)"
        echo "  reset  - Reset database"
        echo "  status - Show status"
        ;;
esac
