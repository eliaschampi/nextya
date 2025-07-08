# NextYa Database System - Clean Architecture

## 🏗️ Architecture Overview

NextYa implements a **hybrid database management system** that combines the best of both worlds:

### **Docker-First Initialization** 
- Complete initial schema in `/docker/init/01-init.sql`
- Automatically applied when PostgreSQL container starts
- Perfect for new deployments and development setup

### **Progressive Migrations**
- Future schema changes via versioned migration files
- Full rollback support with batch tracking
- Automatic TypeScript type generation
- Production-ready with proper error handling

## 🚀 Quick Start

### 1. **Initial Setup**
```bash
# Start database
docker-compose up -d

# Generate TypeScript types
npm run db:generate

# Check everything is working
npm run db:check
```

### 2. **Development Workflow**
```bash
# Health check
npm run dev:health

# Seed development data
npm run dev:seed

# Check migration status
npm run db:status
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

## 🔄 Migration System

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
    .addColumn('user_code', 'uuid', (col) => col.notNull().references('users.code'))
    .addColumn('theme', 'varchar(20)', (col) => col.notNull().defaultTo('light'))
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
import { db } from '$lib/database';
import type { Users } from '$lib/database/types';

// Type-safe queries
const users: Users[] = await db
  .selectFrom('users')
  .selectAll()
  .execute();

// Type-safe inserts
await db
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

### **Development Data**
```bash
# Seed test data
npm run dev:seed

# Clean all data
npm run dev:clean
```

## 🏗️ File Structure

```
nextya/
├── docker/
│   └── init/
│       └── 01-init.sql                    # Initial schema
├── src/lib/database/
│   ├── index.ts                           # Database connection
│   ├── types.ts                           # Generated types (auto-generated)
│   ├── type-generator.ts                  # Enhanced type generation
│   └── migrations/
│       ├── index.ts                       # Migration runner
│       ├── template.ts                    # Migration template
│       └── files/                         # Migration files
│           └── 20250108120000_example.ts
├── scripts/
│   ├── migrate.ts                         # Migration CLI
│   └── dev-tools.ts                       # Development tools
├── docs/
│   └── DATABASE_MANAGEMENT.md             # Detailed documentation
└── package.json                           # NPM scripts
```

## 🎯 Best Practices

### **1. Migration Guidelines**
- Always implement both `up` and `down` functions
- Test rollbacks before deploying to production
- Use descriptive migration names
- Make migrations atomic (all-or-nothing)

### **2. Type Safety**
- Always regenerate types after schema changes
- Use generated types in your application code
- Leverage Kysely's type-safe query builder

### **3. Development Workflow**
- Use `npm run dev:health` to monitor database health
- Seed development data with `npm run dev:seed`
- Analyze schema performance with `npm run dev:analyze`

### **4. Production Deployment**
- Test migrations in staging environment first
- Always backup production database before migrations
- Keep rollback plan ready
- Monitor application after deployment

## 🔧 Troubleshooting

### **Connection Issues**
```bash
# Check Docker containers
docker-compose ps

# Restart containers
docker-compose restart

# Check connection
npm run db:check
```

### **Migration Issues**
```bash
# Check migration status
npm run db:status

# View migration history
docker exec -it nextya_postgres psql -U postgres -d nextya -c "SELECT * FROM _migrations;"
```

### **Type Generation Issues**
```bash
# Manual type generation
npm run db:generate

# Check database schema
docker exec -it nextya_postgres psql -U postgres -d nextya -c "\dt"
```

## 📚 Additional Resources

- [Detailed Database Management Guide](docs/DATABASE_MANAGEMENT.md)
- [Kysely Documentation](https://kysely.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

This system provides a solid foundation for database evolution while maintaining type safety, rollback capabilities, and development productivity. The hybrid approach ensures both rapid development and production reliability.
