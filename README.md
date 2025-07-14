# NextYa

A modern educational management system built with SvelteKit, TypeScript, and PostgreSQL.

## Tech Stack

- **Frontend**: SvelteKit + TypeScript + DaisyUI
- **Database**: PostgreSQL with Kysely query builder
- **Containerization**: Docker & Docker Compose
- **Authentication**: JWT-based sessions

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+

### Setup

```bash
# Complete database setup (unified system)
npm run setup

# Start development
npm run dev
```

### Alternative Docker Setup

```bash
# Using Docker script
./docker.sh up
./docker.sh db:setup

# Start development in container
./docker.sh npm run dev
```

## Available Commands

### Setup & Development
```bash
npm run setup            # Complete database setup (first time)
npm run setup:reset      # Reset and reinitialize database
npm run setup:status     # Show database status
npm run dev              # Start development server
npm run build            # Build for production
npm run test             # Run tests (format + lint + check)
```

### Database (Unified Migration System)
```bash
npm run db:init          # Initialize from SQL files
npm run db:create "name" # Create new migration
npm run db:migrate       # Run pending migrations
npm run db:rollback      # Rollback last migration
npm run db:status        # Show migration status
npm run db:generate      # Generate TypeScript types
npm run db:reset         # Reset database (Docker)
```

### Docker
```bash
./docker.sh up           # Start services
./docker.sh db:setup     # Complete database setup (Docker environment)
./docker.sh db:create    # Create new migration
./docker.sh db:migrate   # Run migrations
./docker.sh db:status    # Show migration status
./docker.sh down         # Stop services
./docker.sh logs         # View logs
./docker.sh shell        # Open shell in app container
```

### Docker-specific Commands (inside container)
```bash
npm run docker:setup     # Setup database (Docker environment)
npm run docker:reset     # Reset database (Docker environment)
npm run docker:status    # Show status (Docker environment)
```

## Database Structure

The database uses a **unified migration system** with organized SQL files:

```
database/
├── init/                      # Organized SQL files (initial schema)
│   ├── 00-config.sql         # Extensions and settings
│   ├── 01-tables.sql         # Table definitions
│   ├── 02-constraints-indexes.sql
│   ├── 03-functions.sql      # Database functions
│   ├── 04-views.sql          # Database views
│   └── 05-grants.sql         # Permissions
├── dev/
│   ├── migrate.ts            # Unified migration system
│   └── setup.sh              # Setup script
└── README.md                 # Database documentation

src/lib/database/
├── migrations/files/         # Generated TypeScript migrations
├── types.ts                  # Auto-generated TypeScript types
└── index.ts                  # Database connection

## Docker & Permissions

### Docker Environment Detection
The system automatically detects if it's running inside Docker and adjusts accordingly:
- **Host system**: Uses `docker exec` commands to interact with containers
- **Docker container**: Uses direct database connections

### Permission Handling
The Docker setup handles file permissions properly:
- Container runs as root to avoid permission issues
- Volume mounts work correctly with the current user
- Migration files are created with proper permissions

### Troubleshooting

#### Permission Issues
```bash
# If you encounter permission issues with migration files
sudo chown -R $USER:$USER src/lib/database/migrations/

# Or reset with proper permissions
./docker.sh db:reset
```

#### Database Connection Issues
```bash
# Check container status
./docker.sh status

# View database logs
docker-compose logs postgres

# Reset everything
./docker.sh down
./docker.sh up
./docker.sh db:setup
```

#### Migration Issues
```bash
# Check migration status
./docker.sh db:status

# Reset database if needed
./docker.sh db:reset
```
├── 01-tables.sql              # Table definitions
├── 02-constraints-indexes.sql # Constraints and indexes
├── 03-functions.sql           # Database functions
├── 04-views.sql               # Database views
└── 05-grants.sql              # Permissions
```

## Environment Variables

```bash
# Database
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=nextya
DB_PORT=5432

# Application
NODE_ENV=development
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=8h
```

## License

MIT License