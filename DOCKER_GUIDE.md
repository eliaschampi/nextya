# 🐳 NextYa Docker Development Guide

**Complete Docker setup and usage guide for the NextYa educational management system**

---

## 📋 **Overview**

NextYa uses Docker for a consistent development environment across all platforms. This guide covers everything you need to know about using Docker with the NextYa project.

### **Architecture**
```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Environment                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   App Container │    │      PostgreSQL Container      │ │
│  │                 │    │                                 │ │
│  │ • SvelteKit 5   │◄──►│ • PostgreSQL 14                │ │
│  │ • Node.js 20    │    │ • Database: nextya              │ │
│  │ • TypeScript    │    │ • User: postgres                │ │
│  │ • Kysely ORM    │    │ • Port: 5432                    │ │
│  │ • Port: 5173    │    │ • Persistent Volume            │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 **Quick Start**

### **Prerequisites**
- Docker Engine 20.10+
- Docker Compose 2.0+
- Git

### **Initial Setup**
```bash
# 1. Clone the repository
git clone <repository-url>
cd nextya

# 2. Run complete setup (builds, starts, migrates, generates types)
./docker.sh setup

# 3. Access the application
# App: http://localhost:5173
# Database: localhost:5432
```

That's it! The setup command handles everything automatically.

---

## 🛠️ **Docker Script Usage**

The project includes a unified `docker.sh` script that handles all Docker operations.

### **Basic Commands**

#### **🏗️ Build & Setup**
```bash
./docker.sh build              # Build Docker images
./docker.sh rebuild            # Clean rebuild (no cache)
./docker.sh setup              # Complete initial setup
```

#### **🚀 Service Management**
```bash
./docker.sh up                 # Start all services
./docker.sh down               # Stop all services
./docker.sh restart            # Restart all services
./docker.sh status             # Show service status
```

#### **📊 Monitoring & Logs**
```bash
./docker.sh logs               # Show all logs
./docker.sh logs app           # Show app logs only
./docker.sh logs postgres      # Show database logs only
./docker.sh logs:follow        # Follow logs in real-time
./docker.sh ps                 # Show running containers
```

#### **🛠️ Development**
```bash
./docker.sh shell              # Open shell in app container
./docker.sh shell:root         # Open root shell in app container
./docker.sh npm <command>      # Run npm command
./docker.sh check              # Run TypeScript checking
./docker.sh test               # Run all tests
./docker.sh dev                # Start development server
```

#### **🗄️ Database Operations**
```bash
./docker.sh db:shell           # Open PostgreSQL shell
./docker.sh db:migrate         # Run database migrations
./docker.sh db:generate        # Generate TypeScript types
./docker.sh db:reset           # Reset database (drop + migrate)
./docker.sh db:backup          # Create database backup
./docker.sh db:restore <file>  # Restore from backup
```

#### **📦 Package Management**
```bash
./docker.sh install <package>  # Install npm package
./docker.sh uninstall <pkg>    # Uninstall npm package
```

#### **🧹 Maintenance**
```bash
./docker.sh clean              # Remove containers and volumes
./docker.sh clean:all          # Remove everything
./docker.sh update             # Update dependencies
```

---

## 📁 **Project Structure**

### **Docker Configuration Files**
```
nextya/
├── docker-compose.yml         # Main Docker Compose configuration
├── docker.sh                  # Unified Docker management script
├── docker/
│   ├── app.dockerfile         # Application container definition
│   └── init/
│       └── 01-init.sql        # Database initialization script
├── .env.docker                # Docker environment variables
└── package.json               # Node.js dependencies and scripts
```

### **Key Configuration Details**

#### **docker-compose.yml**
```yaml
services:
  app:
    container_name: nextya_app
    build:
      context: .
      dockerfile: docker/app.dockerfile
      target: development
    ports:
      - "5173:5173"
    environment:
      - DB_HOST=postgres
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=nextya
      - JWT_SECRET=your-super-secret-jwt-key-change-in-production-2024
    volumes:
      - .:/app:cached
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    container_name: nextya_postgres
    image: postgres:14-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=nextya
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
```

#### **Application Dockerfile**
- **Base**: Node.js 20 Alpine
- **Multi-stage**: Development and Production targets
- **User Mapping**: Matches host UID/GID for file permissions
- **Dependencies**: Installs all npm packages
- **Hot Reload**: Supports live code changes

---

## 🔧 **Development Workflow**

### **Daily Development**
```bash
# Start your day
./docker.sh up                 # Start all services

# Development tasks
./docker.sh npm run dev         # Start development server
./docker.sh check              # Type checking
./docker.sh test               # Run tests

# Database operations
./docker.sh db:generate        # Regenerate types after schema changes
./docker.sh db:migrate         # Apply new migrations

# End of day
./docker.sh down               # Stop all services
```

### **Common Development Tasks**

#### **Installing New Packages**
```bash
# Install a new dependency
./docker.sh install express

# Install dev dependency
./docker.sh install -D @types/express

# Update all dependencies
./docker.sh update
```

#### **Database Management**
```bash
# Create a backup before major changes
./docker.sh db:backup

# Reset database to clean state
./docker.sh db:reset

# Generate types after schema changes
./docker.sh db:generate

# Access database directly
./docker.sh db:shell
```

#### **Debugging**
```bash
# View application logs
./docker.sh logs app

# Follow logs in real-time
./docker.sh logs:follow

# Open shell for debugging
./docker.sh shell

# Check container status
./docker.sh status
```

---

## 🗄️ **Database Configuration**

### **Connection Details**
- **Host**: localhost (from host) / postgres (from container)
- **Port**: 5432
- **Database**: nextya
- **Username**: postgres
- **Password**: postgres

### **Database Schema**
The database is automatically initialized with:
- **Users & Authentication**: JWT-based auth system
- **Educational Structure**: Levels, courses, students, registers
- **Evaluation System**: Exams, questions, answers, results
- **Permissions**: Role-based access control

### **Migrations**
- **Location**: `src/lib/database/migrations/`
- **Tool**: Kysely migrations
- **Commands**:
  ```bash
  ./docker.sh db:migrate        # Run pending migrations
  npm run migrate:up            # Alternative (inside container)
  npm run migrate:down          # Rollback last migration
  ```

### **Type Generation**
- **Tool**: kysely-codegen
- **Output**: `src/lib/database/types.ts`
- **Command**: `./docker.sh db:generate`
- **Auto-generated**: TypeScript interfaces for all tables

---

## 🔐 **Environment Variables**

### **Docker Environment**
```bash
# User mapping (automatically set)
USER_ID=1000
GROUP_ID=1000

# Database configuration
DB_HOST=postgres
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=nextya
DB_PORT=5432

# Application configuration
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-in-production-2024
JWT_EXPIRES_IN=8h
```

### **Production Considerations**
- Change JWT_SECRET to a secure random string
- Use environment-specific database credentials
- Enable SSL for database connections
- Configure proper backup strategies

---

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Port Already in Use**
```bash
# Check what's using the port
lsof -i :5173
lsof -i :5432

# Kill the process or change ports in docker-compose.yml
```

#### **Permission Issues**
```bash
# Fix file permissions
sudo chown -R $USER:$USER .

# Rebuild with correct user mapping
./docker.sh rebuild
```

#### **Database Connection Issues**
```bash
# Check database container status
./docker.sh status

# View database logs
./docker.sh logs postgres

# Restart database
./docker.sh restart
```

#### **Container Won't Start**
```bash
# Clean rebuild
./docker.sh clean
./docker.sh rebuild

# Check Docker daemon
sudo systemctl status docker
```

### **Reset Everything**
```bash
# Nuclear option - removes everything
./docker.sh clean:all

# Then rebuild from scratch
./docker.sh setup
```

---

## 📊 **Performance Optimization**

### **Development Performance**
```bash
# Use cached volumes for better performance
# Already configured in docker-compose.yml
volumes:
  - .:/app:cached

# Exclude node_modules from host sync
# Handled automatically by the Dockerfile
```

### **Database Performance**
```bash
# Monitor database performance
./docker.sh db:shell
# Then run: SELECT * FROM pg_stat_activity;

# Optimize queries using EXPLAIN
# Example: EXPLAIN ANALYZE SELECT * FROM students;
```

### **Container Resource Usage**
```bash
# Monitor container resources
docker stats nextya_app nextya_postgres

# Limit container resources (add to docker-compose.yml)
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '0.5'
```

---

## 🔄 **CI/CD Integration**

### **GitHub Actions Example**
```yaml
name: NextYa CI/CD
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build and test
        run: |
          ./docker.sh build
          ./docker.sh up -d
          ./docker.sh db:migrate
          ./docker.sh test

      - name: Cleanup
        run: ./docker.sh clean
```

### **Production Deployment**
```bash
# Build production image
docker build --target production -t nextya:latest .

# Deploy with production compose
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📚 **Additional Resources**

### **Documentation Links**
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [SvelteKit Documentation](https://kit.svelte.dev/)
- [Kysely Documentation](https://kysely.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### **Project-Specific Guides**
- `MigrationGuide.md` - Complete migration documentation
- `README.md` - Project overview and setup
- `src/lib/database/` - Database schema and migrations

### **Useful Commands Reference**
```bash
# Quick reference card
./docker.sh help                    # Show all commands
./docker.sh setup                   # Initial setup
./docker.sh up                      # Start development
./docker.sh logs app                # Debug issues
./docker.sh db:generate             # Update types
./docker.sh clean && ./docker.sh setup  # Reset everything
```

---

## 🎯 **Best Practices**

### **Development**
1. **Always use the docker.sh script** for consistency
2. **Run type checking** before committing: `./docker.sh check`
3. **Generate types** after schema changes: `./docker.sh db:generate`
4. **Create backups** before major database changes: `./docker.sh db:backup`
5. **Use logs** for debugging: `./docker.sh logs:follow`

### **Database**
1. **Use migrations** for all schema changes
2. **Generate types** automatically with kysely-codegen
3. **Test migrations** with `db:reset` in development
4. **Backup regularly** in production

### **Performance**
1. **Monitor container resources** with `docker stats`
2. **Use cached volumes** for better file sync performance
3. **Optimize database queries** using EXPLAIN ANALYZE
4. **Clean up regularly** with `./docker.sh clean`

---

**🎉 You're all set!** This Docker setup provides a complete, consistent development environment for NextYa. Use `./docker.sh help` anytime to see all available commands.
