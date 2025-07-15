#!/bin/bash
set -e

echo "🚀 NextYa Database Setup"
echo "========================"

is_container() {
    [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null
}

wait_for_db() {
    echo "⏳ Waiting for database..."
    local attempt=1
    while [ $attempt -le 30 ]; do
        if node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nextya',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});
pool.query('SELECT 1').then(() => { pool.end(); process.exit(0); }).catch(() => { pool.end(); process.exit(1); });
" >/dev/null 2>&1; then
            echo "✅ Database ready!"
            return 0
        fi
        echo "⏳ Attempt $attempt/30 (waiting 2s)..."
        sleep 2
        ((attempt++))
    done
    echo "❌ Database connection timeout after 60 seconds"
    return 1
}

is_db_initialized() {
    node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nextya',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});
pool.query(\"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'\")
  .then(result => {
    pool.end();
    process.exit(result.rows[0].count > 0 ? 0 : 1);
  })
  .catch(() => {
    pool.end();
    process.exit(1);
  });
" >/dev/null 2>&1
}

setup_database() {
    if ! is_container; then
        echo "❌ This script must run inside container"
        echo "💡 Use: ./docker.sh setup"
        exit 1
    fi

    echo "🔍 Checking database connection..."
    if ! wait_for_db; then
        echo "❌ Setup failed - cannot connect to database"
        echo "💡 Make sure PostgreSQL container is running"
        exit 1
    fi

    echo "🔍 Checking database state..."
    if is_db_initialized; then
        echo "✅ Database already initialized"
        echo "🔄 Running pending migrations..."
        npm run db:migrate
        echo "🔧 Generating TypeScript types..."
        npm run db:generate
    else
        echo "🔄 Initializing database from init files..."
        npm run db:init
        echo "🔄 Running initial migrations..."
        npm run db:migrate
        echo "🔧 Generating TypeScript types..."
        npm run db:generate
    fi

    echo ""
    echo "✅ Database setup completed successfully!"
    echo "💡 Use 'npm run db:status' to check migration status"
}

reset_database() {
    echo "❌ Database reset not available from container"
    echo "💡 Use: ./docker.sh setup:reset"
    exit 1
}

show_status() {
    echo "📊 NextYa Database Status"
    echo "========================="

    echo "🔍 Checking database connection..."
    if wait_for_db >/dev/null 2>&1; then
        echo "✅ Database connection: OK"

        echo "🔍 Checking database tables..."
        if is_db_initialized; then
            echo "✅ Database tables: Initialized"
            echo "📋 Migration Status:"
            npm run db:status 2>/dev/null || echo "Migration system not yet initialized"
        else
            echo "⚠️  Database tables: Not initialized"
            echo "💡 Run: ./docker.sh setup"
        fi
    else
        echo "❌ Database connection: Failed"
        echo "💡 Make sure containers are running: ./docker.sh up"
    fi
}

case "${1:-setup}" in
    "setup"|"init") setup_database ;;
    "reset") reset_database ;;
    "status") show_status ;;
    *)
        echo "NextYa Database Setup"
        echo "Usage: bash database/dev/setup.sh [command]"
        echo "Commands:"
        echo "  setup   - Initialize database (default)"
        echo "  reset   - Reset database (use docker.sh setup:reset)"
        echo "  status  - Show database and migration status"
        ;;
esac
