# NextYa - Modern SvelteKit Application

A modern, type-safe web application built with SvelteKit, TypeScript, and PostgreSQL, featuring a hybrid database management system with Docker-first initialization and progressive migrations.

## 🏗️ Architecture Overview

NextYa implements a **clean architecture** with the following key components:

### **Hybrid Database Management System**
- **Docker-First Initialization**: Complete initial schema in `/docker/init/01-init.sql`
- **Progressive Migrations**: Future schema changes via versioned migration files
- **Automatic Type Generation**: TypeScript types generated from database schema
- **Full Rollback Support**: Safe rollback capabilities with batch tracking

### **Technology Stack**
- **Frontend**: SvelteKit with TypeScript
- **Database**: PostgreSQL 14 with Kysely query builder
- **Containerization**: Docker & Docker Compose
- **Type Safety**: Full end-to-end TypeScript with auto-generated database types
- **Development Tools**: Comprehensive CLI tools for database management

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- npm or yarn

### 1. Initial Setup

```bash
# Clone and navigate to project
git clone <repository-url>
cd nextya

# Start database and application
docker-compose up -d

# Generate TypeScript types
npm run db:generate

# Verify everything is working
npm run db:check
```

### 2. Development Workflow

```bash
# Start development server
npm run dev

# Database health check
npm run dev:health

# Check migration status
npm run db:status

# Seed development data
npm run dev:seed
```

## 📋 Available Commands

### **Database Management**
```bash
npm run db:migrate        # Run pending migrations
npm run db:rollback       # Rollback last migration batch
npm run db:status         # Show migration status
npm run db:generate       # Generate TypeScript types
npm run db:create "name"  # Create new migration
npm run db:check          # Check database connection
npm run db:reset          # Reset database (Docker)
npm run db:fresh          # Reset + generate types
```

### **Development Tools**
```bash
npm run dev:health        # Database health check
npm run dev:analyze       # Schema analysis & optimization
npm run dev:seed          # Seed development data
npm run dev:clean         # Clean all data
npm run dev:report        # Generate development report
```

### **Docker Management**
```bash
./docker.sh build        # Build Docker images
./docker.sh up           # Start services
./docker.sh down         # Stop services
./docker.sh logs         # View logs
./docker.sh shell        # Access app container shell
./docker.sh db:shell     # Access database shell
./docker.sh npm [cmd]    # Run npm commands in container
```

### **Standard Development**
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build
npm run test             # Run tests
npm run lint             # Lint code
npm run format           # Format code
```

## 🔄 Database Migration System

### **Creating Migrations**

1. **Create migration file:**
```bash
npm run db:create "add user preferences"
```

2. **Edit the generated file:**
```typescript
// src/lib/database/migrations/files/20250108120000_add_user_preferences.ts
import { Kysely, sql } from 'kysely';

export const name = 'Add user preferences';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('user_preferences')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_code', 'uuid', (col) => col.notNull().references('users.code').onDelete('cascade'))
    .addColumn('theme', 'varchar(20)', (col) => col.notNull().defaultTo('light'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('user_preferences').execute();
}
```

3. **Run migration:**
```bash
npm run db:migrate
```

### **Migration Features**
- ✅ **Version Control**: Each migration is timestamped and tracked
- ✅ **Rollback Support**: Safe rollback to previous state
- ✅ **Batch Tracking**: Migrations are grouped in batches
- ✅ **Type Generation**: Automatic TypeScript type updates
- ✅ **Error Handling**: Comprehensive error handling and recovery

## 📝 Type System

### **Automatic Generation**
Types are automatically generated from your database schema:

```typescript
// Generated in src/lib/database/types.ts
export interface Users {
  code: Generated<string>;
  email: string;
  name: string | null;
  created_at: Generated<Timestamp>;
  // ... more fields
}

export interface DB {
  users: Users;
  courses: Courses;
  // ... more tables
}
```

### **Usage in Code**
```typescript
import { dbInstance } from '$lib/config/server';
import type { Users } from '$lib/database/types';

// Type-safe queries
const users: Users[] = await dbInstance
  .selectFrom('users')
  .selectAll()
  .execute();

// Type-safe inserts
await dbInstance
  .insertInto('users')
  .values({
    email: 'user@example.com',
    name: 'John Doe'
    // TypeScript ensures all required fields are provided
  })
  .execute();
```

## 🛠️ Development Features

### **Health Monitoring**
```bash
npm run dev:health
```
- Connection speed testing
- Table record counts
- Database size monitoring
- Active connection tracking

### **Schema Analysis**
```bash
npm run dev:analyze
```
- Missing index detection
- Table size analysis
- Performance optimization suggestions

### **Development Data Management**
```bash
# Seed test data
npm run dev:seed

# Clean all data
npm run dev:clean

# Generate development report
npm run dev:report
```

## 🏗️ Project Structure

```
nextya/
├── docker/
│   ├── app.dockerfile                     # Multi-stage Docker build
│   └── init/
│       └── 01-init.sql                    # Initial database schema
├── src/
│   ├── lib/
│   │   ├── auth/                          # Authentication system
│   │   ├── config/
│   │   │   ├── env.ts                     # Client-side config
│   │   │   └── server.ts                  # Server-side config
│   │   └── database/
│   │       ├── index.ts                   # Database connection factory
│   │       ├── types.ts                   # Generated types (auto-generated)
│   │       ├── type-generator.ts          # Enhanced type generation
│   │       └── migrations/
│   │           ├── index.ts               # Migration runner
│   │           ├── template.ts            # Migration template
│   │           └── files/                 # Migration files
│   │               └── [timestamp]_[name].ts
│   ├── routes/                            # SvelteKit routes
│   └── hooks.server.ts                    # Server hooks
├── scripts/
│   ├── migrate.ts                         # Migration CLI tool
│   └── dev-tools.ts                       # Development utilities
├── docs/                                  # Documentation (to be removed)
├── docker-compose.yml                     # Docker services configuration
├── docker.sh                              # Docker management script
├── kysely.config.ts                       # Kysely codegen configuration
├── package.json                           # Dependencies and scripts
└── README.md                              # This file
```

## 🎯 Best Practices

### **1. Migration Guidelines**
- Always implement both `up` and `down` functions
- Test rollbacks before deploying to production
- Use descriptive migration names
- Make migrations atomic (all-or-nothing)
- Never edit existing migration files after they've been run

### **2. Type Safety**
- Always regenerate types after schema changes: `npm run db:generate`
- Use generated types in your application code
- Leverage Kysely's type-safe query builder
- Never manually edit `src/lib/database/types.ts`

### **3. Development Workflow**
- Use `npm run dev:health` to monitor database health
- Seed development data with `npm run dev:seed`
- Analyze schema performance with `npm run dev:analyze`
- Check migration status regularly with `npm run db:status`

### **4. Production Deployment**
- Test migrations in staging environment first
- Always backup production database before migrations
- Keep rollback plan ready
- Monitor application after deployment
- Use environment variables for all configuration

### **5. Docker Best Practices**
- Use `./docker.sh` for consistent Docker operations
- Keep containers updated and secure
- Use multi-stage builds for production
- Properly handle user permissions in containers

## 🔧 Troubleshooting

### **Connection Issues**
```bash
# Check Docker containers
docker-compose ps

# Restart containers
docker-compose restart

# Check database connection
npm run db:check

# View container logs
./docker.sh logs
```

### **Migration Issues**
```bash
# Check migration status
npm run db:status

# View migration history
docker exec -it nextya_postgres psql -U postgres -d nextya -c "SELECT * FROM _migrations ORDER BY executed_at;"

# Reset database (development only)
npm run db:reset
```

### **Type Generation Issues**
```bash
# Manual type generation
npm run db:generate

# Check database schema
docker exec -it nextya_postgres psql -U postgres -d nextya -c "\dt"

# Verify database connection
npm run db:check
```

### **Docker Issues**
```bash
# Rebuild containers
./docker.sh down
./docker.sh build
./docker.sh up

# Clean Docker system (careful!)
docker system prune -a

# Check container health
docker exec -it nextya_postgres pg_isready -U postgres
```

## 🚀 Production Deployment

### **Environment Variables**
Ensure these environment variables are set in production:

```bash
# Database
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-secure-password
DB_NAME=nextya
DB_PORT=5432

# Application
NODE_ENV=production
JWT_SECRET=your-super-secure-jwt-secret
JWT_EXPIRES_IN=8h
```

### **Deployment Steps**
1. **Prepare Environment**: Set all required environment variables
2. **Database Setup**: Run initial schema or migrations
3. **Build Application**: `npm run build`
4. **Start Services**: Use production Docker configuration
5. **Health Check**: Verify all services are running
6. **Monitor**: Set up logging and monitoring

## 📚 Additional Resources

- [SvelteKit Documentation](https://kit.svelte.dev/)
- [Kysely Documentation](https://kysely.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes following the best practices above
4. Test your changes: `npm run test`
5. Create migrations if needed: `npm run db:create "description"`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**NextYa** - A modern, type-safe web application with clean architecture and comprehensive database management.