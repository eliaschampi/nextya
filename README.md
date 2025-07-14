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
# Start services
docker-compose up -d

# Generate database types
npm run db:generate

# Start development
npm run dev
```

## Available Commands

### Development
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run test             # Run tests (format + lint + check)
```

### Database
```bash
npm run db:migrate       # Run migrations
npm run db:generate      # Generate TypeScript types
npm run db:status        # Show migration status
```

### Docker
```bash
./docker.sh up          # Start services
./docker.sh down        # Stop services
./docker.sh logs        # View logs
```

## Database Structure

The database schema is organized in modular files:

```
docker/init/
├── 00-config.sql              # Extensions and settings
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