# NextYa Database Management Guide

## Architecture Overview

NextYa uses a **hybrid database management approach** that combines Docker-first initialization with progressive migrations:

### 🏗️ **Initial Schema (Docker-First)**
- **Location**: `/docker/init/01-init.sql`
- **Purpose**: Complete initial database schema
- **When**: Automatically applied when PostgreSQL container starts
- **Contains**: Tables, indexes, functions, triggers, views, RLS policies

### 🔄 **Future Changes (Progressive Migrations)**
- **Location**: `/src/lib/database/migrations/files/`
- **Purpose**: Incremental schema changes after initial deployment
- **When**: Run manually via CLI commands
- **Features**: Version control, rollback support, automatic type generation

### 📝 **TypeScript Types**
- **Location**: `/src/lib/database/types.ts`
- **Purpose**: Type-safe database operations
- **Generation**: Automatic via `kysely-codegen`
- **Updates**: After migrations or on-demand

## Quick Start Commands

```bash
# Check database connection
npm run db:check

# Generate TypeScript types
npm run db:generate

# Show migration status
npm run db:status

# Reset database (Docker)
npm run db:reset

# Fresh start (reset + generate types)
npm run db:fresh
```

## Migration Workflow

### 1. **Creating a New Migration**

```bash
# Create a new migration file
npm run db:create "add user preferences"
```

This creates: `src/lib/database/migrations/files/20250108120000_add_user_preferences.ts`

### 2. **Edit the Migration File**

```typescript
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

### 3. **Run the Migration**

```bash
# Run all pending migrations
npm run db:migrate
```

This will:
- Execute the migration
- Track it in the `_migrations` table
- Automatically regenerate TypeScript types

### 4. **Rollback if Needed**

```bash
# Rollback the last batch of migrations
npm run db:rollback
```

## Advanced Commands

### Migration Management
```bash
# Create migration
npm run db:create "migration name"

# Run migrations
npm run db:migrate

# Rollback last batch
npm run db:rollback

# Check migration status
npm run db:status
```

### Type Generation
```bash
# Generate types from current schema
npm run db:generate

# Check database connection
npm run db:check
```

### Database Reset
```bash
# Reset database (removes all data)
npm run db:reset

# Reset and regenerate types
npm run db:fresh
```

## Best Practices

### 1. **Migration Naming**
- Use descriptive names: `add_user_preferences`, `create_audit_table`
- Migrations are automatically timestamped
- Files are executed in chronological order

### 2. **Migration Structure**
- Always implement both `up` and `down` functions
- Make migrations atomic (all-or-nothing)
- Test rollbacks before deploying

### 3. **Schema Changes**
- Use consistent naming conventions (see existing schema)
- Add indexes for foreign keys and frequently queried columns
- Include appropriate constraints and defaults

### 4. **Type Safety**
- Types are automatically regenerated after migrations
- Always run `npm run db:generate` after manual schema changes
- Use generated types in your application code

## Development Workflow

### For New Features
1. **Plan the schema changes**
2. **Create migration**: `npm run db:create "feature name"`
3. **Implement up/down functions**
4. **Test migration**: `npm run db:migrate`
5. **Test rollback**: `npm run db:rollback`
6. **Re-run migration**: `npm run db:migrate`
7. **Verify types are updated**

### For Production Deployment
1. **Test migrations in staging environment**
2. **Backup production database**
3. **Run migrations**: `npm run db:migrate`
4. **Verify application functionality**
5. **Keep rollback plan ready**

## Troubleshooting

### Connection Issues
```bash
# Check if Docker containers are running
docker-compose ps

# Start containers
docker-compose up -d

# Check database connection
npm run db:check
```

### Migration Issues
```bash
# Check migration status
npm run db:status

# View migration table directly
docker exec -it nextya_postgres psql -U postgres -d nextya -c "SELECT * FROM _migrations ORDER BY executed_at;"
```

### Type Generation Issues
```bash
# Manual type generation
npm run db:generate

# Check database schema
docker exec -it nextya_postgres psql -U postgres -d nextya -c "\dt"
```

## File Structure

```
nextya/
├── docker/
│   └── init/
│       └── 01-init.sql              # Initial schema
├── src/lib/database/
│   ├── index.ts                     # Database connection
│   ├── types.ts                     # Generated types
│   └── migrations/
│       ├── index.ts                 # Migration runner
│       ├── template.ts              # Migration template
│       └── files/                   # Migration files
│           ├── 20250108120000_example.ts
│           └── ...
├── scripts/
│   └── migrate.ts                   # CLI tool
└── package.json                     # NPM scripts
```

This architecture provides a solid foundation for database evolution while maintaining type safety and rollback capabilities.
