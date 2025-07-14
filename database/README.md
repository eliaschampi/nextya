# NextYa Database - Unified Migration System

## 🎯 **Single, Clean, Efficient Migration System**

This project uses **ONE unified migration system** that combines the best of both worlds:
- **Organized SQL files** for initial schema design
- **Kysely TypeScript migrations** for ongoing development
- **Professional workflow** with proper rollback support

## 🚀 **Quick Start**

### **First Time Setup:**
```bash
npm run setup
# or
./database/dev/setup.sh
```

### **Development Workflow:**
```bash
# Create new migration
npm run db:create "add_new_feature"

# Run migrations
npm run db:migrate

# Check status
npm run db:status

# Rollback if needed
npm run db:rollback
```

## 📁 **Project Structure**

```
database/
├── init/                    # Organized SQL files (initial schema)
│   ├── 00-config.sql       # Database configuration
│   ├── 01-tables.sql       # Table definitions
│   ├── 02-constraints-indexes.sql
│   ├── 03-functions.sql    # Database functions
│   ├── 04-views.sql        # Database views
│   └── 05-grants.sql       # Permissions
├── dev/
│   ├── migrate.ts          # Unified migration system
│   └── setup.sh           # Setup script
└── README.md              # This file

src/lib/database/
├── migrations/files/       # Generated TypeScript migrations
├── types.ts               # Auto-generated TypeScript types
└── index.ts              # Database connection
```

## 🔧 **Available Commands**

### **Setup Commands:**
- `npm run setup` - Complete database setup (first time)
- `npm run setup:reset` - Reset and reinitialize database
- `npm run setup:status` - Show database status

### **Migration Commands:**
- `npm run db:init` - Initialize from SQL files (internal use)
- `npm run db:create "name"` - Create new migration
- `npm run db:migrate` - Run pending migrations
- `npm run db:rollback` - Rollback last migration
- `npm run db:status` - Show migration status
- `npm run db:generate` - Generate TypeScript types
- `npm run db:reset` - Reset database (Docker)

## 🏗️ **How It Works**

### **1. Initial Setup:**
- Your organized SQL files in `database/init/` define the initial schema
- `npm run setup` converts these into a single Kysely migration
- Database is initialized with proper migration tracking

### **2. Development Changes:**
- Use `npm run db:create "feature_name"` for new changes
- Edit the generated TypeScript migration file
- Run `npm run db:migrate` to apply changes
- Full rollback support with `npm run db:rollback`

### **3. Type Safety:**
- Automatic TypeScript type generation from database schema
- Types are updated after each migration
- Full IntelliSense support in your application

## ✅ **Benefits of This System**

1. **Single Source of Truth**: One migration system, no confusion
2. **Clean Organization**: Your SQL files remain organized and readable
3. **Professional Workflow**: Industry-standard migration patterns
4. **Type Safety**: Automatic TypeScript type generation
5. **Rollback Support**: Proper up/down migration functions
6. **Performance**: Minimal overhead, efficient execution
7. **Maintainable**: Easy to understand and debug

## 🔄 **Migration Workflow Example**

```bash
# 1. First time setup
npm run setup

# 2. Make schema changes
npm run db:create "add_user_preferences"

# 3. Edit the generated migration file
# src/lib/database/migrations/files/20240714120000_add_user_preferences.ts

# 4. Apply the migration
npm run db:migrate

# 5. Types are automatically updated
npm run db:generate  # (runs automatically after migrate)
```

## 🛠️ **Troubleshooting**

### **Database Connection Issues:**
```bash
# Check Docker containers
docker-compose ps

# Check database status
npm run setup:status

# Reset if needed
npm run setup:reset
```

### **Migration Issues:**
```bash
# Check migration status
npm run db:status

# Rollback problematic migration
npm run db:rollback

# Reset database completely
npm run db:reset
```

## 📝 **Best Practices**

1. **Always test migrations** in development before production
2. **Write proper rollback logic** in down() functions
3. **Use descriptive migration names** for clarity
4. **Keep migrations small and focused** on single changes
5. **Never edit existing migrations** once they're applied

## 🎉 **Result**

You now have a **single, unified, professional migration system** that:
- ✅ Uses your organized SQL files for initial setup
- ✅ Provides modern TypeScript migrations for development
- ✅ Has proper rollback support
- ✅ Generates TypeScript types automatically
- ✅ Follows industry best practices
- ✅ Is clean, maintainable, and efficient

**No more dual systems, no more confusion - just one clean, professional workflow!** 🚀
