# NextYa

Modern educational management system with **clean code philosophy**, **minimalism approach**, and **extremely fast performance**.

## 🚀 Tech Stack

- **Frontend**: SvelteKit + TypeScript + DaisyUI + TailwindCSS
- **Database**: PostgreSQL 16 with Kysely query builder
- **Containerization**: Docker & Docker Compose
- **Authentication**: JWT-based sessions
- **Migration System**: Custom TypeScript-based migrations

## ⚡ Quick Start

**Prerequisites**: Docker & Docker Compose installed

```bash
# Complete setup (3 commands)
./docker.sh build    # Build images
./docker.sh up        # Start containers
./docker.sh setup     # Initialize database

# Start development
# → http://localhost:5173
```

## 📋 Commands

### 🐳 Docker Commands
```bash
# Core workflow
./docker.sh build                    # Build images
./docker.sh up                       # Start containers
./docker.sh down                     # Stop containers
./docker.sh status                   # Show status
./docker.sh logs                     # View logs

# Database
./docker.sh setup                    # Initialize database
./docker.sh setup:reset              # Reset database
./docker.sh db:migrate               # Run migrations
./docker.sh db:rollback              # Rollback migrations
./docker.sh db:status                # Migration status
./docker.sh db:create "name"         # Create migration
./docker.sh db:generate              # Generate types
./docker.sh db:shell                 # PostgreSQL shell

# Development
./docker.sh npm rebuild @u4/opencv4nodejs            # Development server
./docker.sh npm run build            # Build production
./docker.sh npm run test             # Run tests
./docker.sh shell                    # App container shell
```

## 🗄️ Database Structure

```
database/
├── init/                           # Initial schema (sorted by importance)
│   ├── 00-config.sql              # Extensions, settings
│   ├── 01-tables.sql              # Tables
│   ├── 02-constraints-indexes.sql # Constraints, indexes
│   ├── 03-functions*.sql          # Functions
│   ├── 04-views.sql               # Views
│   └── 05-grants.sql              # Permissions
├── migrations/                     # Future changes
└── dev/
    ├── migrate.ts                 # Migration system
    └── setup.sh                   # Setup script
```

**Migration Features**: Initialization, tracking, rollbacks, type generation, container-aware

## 🔧 Environment

Docker automatically configures:
- `DB_HOST=postgres` (container name)
- `DB_USER=postgres`, `DB_PASSWORD=postgres`, `DB_NAME=nextya`
- `JWT_SECRET`, `NODE_ENV=development`

External connection: `localhost:5432` (postgres/postgres)

## 🚀 Workflows

### First Time Setup
```bash
git clone <repository-url> && cd nextya
./docker.sh build && ./docker.sh up && ./docker.sh setup
./docker.sh logs  # → http://localhost:5173
```

### Daily Development
```bash
./docker.sh up                              # Start containers
./docker.sh npm run dev                     # Development server
./docker.sh db:create "add feature"         # Create migration
./docker.sh db:migrate                      # Apply changes
./docker.sh db:generate                     # Update types
```

### Database Management
```bash
./docker.sh db:status                       # Check status
./docker.sh db:rollback                     # Rollback if needed
./docker.sh setup:reset                     # Complete reset
```

## 🛠️ Troubleshooting

```bash
# Container issues
./docker.sh status                          # Check status
./docker.sh logs                            # View logs
./docker.sh restart                         # Restart

# Database issues
./docker.sh db:shell                        # PostgreSQL shell
./docker.sh setup:reset                     # Complete reset

# Migration issues
./docker.sh db:status                       # Check migrations
./docker.sh setup:reset                     # Reset if corrupted
```

## 🏗️ Architecture

**Clean code philosophy**: Minimalist approach, extremely fast performance, container-first design, full TypeScript integration, migration-driven development.

## 📝 License

MIT License