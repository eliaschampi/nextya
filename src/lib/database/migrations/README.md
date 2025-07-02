# Nextya Database Migrations

## 🎯 Overview

This directory contains the organized database migration files for the Nextya evaluation system. The migrations have been restructured for better maintainability and consistency.

## 📁 Structure

### Migration Files (Execution Order)
1. **001_create_tables.ts** - Creates all database tables
2. **002_create_functions.ts** - Creates database functions for analytics
3. **003_create_indexes.ts** - Creates performance indexes
4. **004_create_triggers.ts** - Creates triggers for data validation and automation
5. **005_create_views.ts** - Creates convenient views for reporting

### SQL Source Files
- **sql/01_tables.sql** - Clean table definitions
- **sql/02_functions.sql** - Database functions
- **sql/03_indexes.sql** - Performance indexes
- **sql/04_triggers.sql** - Data validation and automation triggers
- **sql/05_views.sql** - Reporting and analytics views

## 🚀 Usage

### Run Migrations
```bash
# Run all pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down
```

### Docker Environment
```bash
# Run migrations inside container
docker exec -it nextya_app npm run migrate:up

# Generate types after migration
docker exec -it nextya_app npm run db:generate
```

## 📊 Database Schema

### Core Tables
- **users** - System users (teachers/admins)
- **students** - Student records
- **levels** - Academic levels
- **courses** - Subject courses
- **permissions** - User permissions

### Evaluation Tables
- **evals** - Evaluations/exams
- **eval_sections** - Course-specific sections within evaluations
- **eval_questions** - Individual questions
- **eval_answers** - Student answers
- **eval_results** - Calculated results

### Registration
- **registers** - Student-level assignments

## 🔧 Key Features

### Automatic Calculations
- **Triggers** automatically calculate scores when answers are submitted
- **Total questions** are updated when questions are added/removed
- **Email validation** ensures data integrity

### Performance Optimization
- **Comprehensive indexes** for fast queries
- **Partial indexes** for specific conditions
- **Composite indexes** for complex queries

### Analytics Functions
- `get_student_score_evolution()` - Track student progress over time
- `get_student_course_performance()` - Course-specific performance
- `get_eval_dashboard_data()` - Comprehensive evaluation analytics
- `get_student_eval_report()` - Detailed reporting for CSV export

### Convenient Views
- `v_students_complete` - Students with teacher information
- `v_evaluations_complete` - Evaluations with all related data
- `v_student_results_summary` - Performance summaries
- `v_question_difficulty` - Question analysis
- `v_course_performance` - Course statistics

## 🔄 Migration from Old Structure

The old migration files have been reorganized:
- **001_initial.ts** → Split into organized SQL files
- **002_dashboard_functions.ts** → Merged into 02_functions.sql
- **003_eval_dashboard_functions.ts** → Merged into 02_functions.sql

## 🛠️ Development

### Adding New Migrations
1. Create new migration file with incremental number
2. Follow the pattern: `006_description.ts`
3. Include both `up()` and `down()` functions
4. Test thoroughly before committing

### Modifying Schema
1. **Never modify existing migration files**
2. Create new migration for schema changes
3. Update corresponding SQL files if needed
4. Regenerate types: `npm run db:generate`

## 🔍 Troubleshooting

### Common Issues
- **Migration fails**: Check PostgreSQL logs
- **Type errors**: Regenerate types after schema changes
- **Performance issues**: Review index usage

### Useful Commands
```bash
# Check migration status
npm run migrate

# Reset database (development only)
docker-compose down -v
docker-compose up -d

# View database logs
docker logs nextya_postgres
```

## 📝 Notes

- All migrations are **idempotent** (safe to run multiple times)
- **Foreign key constraints** ensure data integrity
- **UUID primary keys** for better scalability
- **Timestamps** on all tables for audit trails
- **Proper indexing** for optimal query performance
