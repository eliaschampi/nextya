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

### Setup (Any Computer/OS)

```bash
# Complete setup - works on any system with Docker
./docker.sh db:setup

# Start development
./docker.sh npm run dev
```

## Available Commands

### Docker Commands (Recommended)
```bash
./docker.sh up           # Start containers
./docker.sh db:setup     # Complete database setup
./docker.sh db:create    # Create new migration
./docker.sh db:migrate   # Run migrations
./docker.sh db:status    # Show migration status
./docker.sh npm run dev  # Start development server
./docker.sh shell        # Open container shell
./docker.sh down         # Stop containers
```

### Container Commands (Inside Container)
```bash
npm run setup            # Database setup
npm run setup:status     # Show database status
npm run dev              # Start development server
npm run build            # Build for production
npm run test             # Run tests (format + lint + check)
```

### Database Migration Commands
```bash
npm run db:create "name" # Create new migration
npm run db:migrate       # Run pending migrations
npm run db:rollback      # Rollback last migration
npm run db:status        # Show migration status
npm run db:generate      # Generate TypeScript types
```

## Database Structure

Clean, organized SQL files with unified migration system:

```
database/
├── init/                    # Organized SQL files (initial schema)
│   ├── 00-config.sql       # Extensions, settings, enums
│   ├── 01-tables.sql       # Table definitions
│   ├── 02-constraints-indexes.sql
│   ├── 03-functions.sql    # Database functions
│   ├── 04-views.sql        # Database views
│   └── 05-grants.sql       # Permissions
└── dev/
    ├── migrate.ts          # Migration system
    └── setup.sh            # Setup script

src/lib/database/
├── migrations/files/       # Generated TypeScript migrations
├── types.ts               # Auto-generated TypeScript types
└── index.ts              # Database connection
```

## Environment Variables

```bash
# Database (Docker handles these automatically)
DB_HOST=postgres
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=nextya
DB_PORT=5432

# Application
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-in-production-2024
JWT_EXPIRES_IN=8h
```

## Troubleshooting

### Database Issues
```bash
# Check status
./docker.sh status

# Reset everything
./docker.sh db:reset

# View logs
./docker.sh logs
```

### Migration Issues
```bash
# Check migration status
./docker.sh db:status

# Reset database if needed
./docker.sh db:reset
```

## Development Workflow

1. **First time setup**: `./docker.sh db:setup`
2. **Start development**: `./docker.sh npm run dev`
3. **Create new features**: `./docker.sh db:create "feature_name"`
4. **Apply changes**: `./docker.sh db:migrate`
5. **Check status**: `./docker.sh db:status`

## License

MIT License