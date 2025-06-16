import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
	// Enable required extensions
	await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);
	await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`.execute(db);

	// Users table (replacing auth.users)
	await db.schema
		.createTable('users')
		.addColumn('code', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
		.addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
		.addColumn('password_hash', 'text', (col) => col.notNull())
		.addColumn('name', 'varchar(100)')
		.addColumn('last_name', 'varchar(150)')
		.addColumn('photo_url', 'text')
		.addColumn('last_login', 'timestamptz')
		.addColumn('is_email_verified', 'boolean', (col) => col.notNull().defaultTo(false))
		.addColumn('is_super_admin', 'boolean', (col) => col.notNull().defaultTo(false))
		.addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();

	// Permissions table
	await db.schema
		.createTable('permissions')
		.addColumn('code', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
		.addColumn('user_code', 'uuid', (col) => col.notNull().references('users.code').onDelete('cascade'))
		.addColumn('entity', 'varchar(50)', (col) => col.notNull())
		.addColumn('action', 'varchar(50)', (col) => col.notNull())
		.addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();

	// Add unique constraint for permissions
	await db.schema
		.createIndex('permissions_user_entity_action_unique')
		.on('permissions')
		.columns(['user_code', 'entity', 'action'])
		.unique()
		.execute();

	// Levels table
	await db.schema
		.createTable('levels')
		.addColumn('code', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
		.addColumn('name', 'varchar(100)', (col) => col.notNull())
		.addColumn('abr', 'text', (col) => col.notNull())
		.addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn('users', sql`uuid[]`, (col) => col.notNull().defaultTo(sql`'{}'`))
		.execute();

	// Courses table
	await db.schema
		.createTable('courses')
		.addColumn('code', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
		.addColumn('name', 'varchar(100)', (col) => col.notNull())
		.addColumn('user_code', 'uuid', (col) => col.notNull().references('users.code').onDelete('cascade'))
		.addColumn('abr', 'text', (col) => col.notNull())
		.addColumn('order', 'integer', (col) => col.notNull().defaultTo(0))
		.addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();

	// Students table
	await db.schema
		.createTable('students')
		.addColumn('code', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
		.addColumn('name', 'varchar(100)', (col) => col.notNull())
		.addColumn('last_name', 'varchar(150)', (col) => col.notNull())
		.addColumn('email', 'varchar(100)', (col) => col.notNull())
		.addColumn('phone', 'varchar(100)')
		.addColumn('user_code', 'uuid', (col) => col.notNull().references('users.code').onDelete('cascade'))
		.addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();

	// Add unique constraint for students
	await db.schema
		.createIndex('students_name_lastname_unique')
		.on('students')
		.columns(['name', 'last_name'])
		.unique()
		.execute();

	// Registers table
	await db.schema
		.createTable('registers')
		.addColumn('code', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
		.addColumn('student_code', 'uuid', (col) => col.notNull().references('students.code').onDelete('cascade'))
		.addColumn('level_code', 'uuid', (col) => col.notNull().references('levels.code').onDelete('cascade'))
		.addColumn('group_name', 'char(1)', (col) => col.notNull())
		.addColumn('user_code', 'uuid', (col) => col.notNull().references('users.code').onDelete('cascade'))
		.addColumn('roll_code', 'char(4)', (col) => col.notNull())
		.addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();

	// Add constraints for registers
	await sql`ALTER TABLE registers ADD CONSTRAINT ck_registers_group CHECK (group_name IN ('A','B','C','D'))`.execute(db);
	
	await db.schema
		.createIndex('registers_student_level_group_unique')
		.on('registers')
		.columns(['student_code', 'level_code', 'group_name'])
		.unique()
		.execute();

	await db.schema
		.createIndex('registers_level_roll_unique')
		.on('registers')
		.columns(['level_code', 'roll_code'])
		.unique()
		.execute();

	// Evals table
	await db.schema
		.createTable('evals')
		.addColumn('code', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
		.addColumn('name', 'varchar', (col) => col.notNull())
		.addColumn('level_code', 'uuid', (col) => col.notNull().references('levels.code'))
		.addColumn('group_name', 'char(1)', (col) => col.notNull())
		.addColumn('eval_date', 'date', (col) => col.notNull())
		.addColumn('user_code', 'uuid', (col) => col.notNull().references('users.code'))
		.addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();

	await sql`ALTER TABLE evals ADD CONSTRAINT ck_evals_group CHECK (group_name IN ('A','B','C','D'))`.execute(db);

	// Eval sections table
	await db.schema
		.createTable('eval_sections')
		.addColumn('code', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
		.addColumn('eval_code', 'uuid', (col) => col.notNull().references('evals.code').onDelete('cascade'))
		.addColumn('course_code', 'uuid', (col) => col.notNull().references('courses.code'))
		.addColumn('order_in_eval', 'integer', (col) => col.notNull())
		.addColumn('question_count', 'integer', (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex('eval_sections_eval_course_unique')
		.on('eval_sections')
		.columns(['eval_code', 'course_code'])
		.unique()
		.execute();

	await db.schema
		.createIndex('eval_sections_eval_order_unique')
		.on('eval_sections')
		.columns(['eval_code', 'order_in_eval'])
		.unique()
		.execute();

	// Eval questions table
	await db.schema
		.createTable('eval_questions')
		.addColumn('code', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
		.addColumn('eval_code', 'uuid', (col) => col.notNull().references('evals.code').onDelete('cascade'))
		.addColumn('section_code', 'uuid', (col) => col.notNull().references('eval_sections.code').onDelete('cascade'))
		.addColumn('order_in_eval', 'integer', (col) => col.notNull())
		.addColumn('correct_key', 'char(1)', (col) => col.notNull())
		.addColumn('omitable', 'boolean', (col) => col.defaultTo(false))
		.addColumn('score_percent', sql`numeric(3,2)`, (col) => col.notNull().defaultTo(1.00))
		.execute();

	await sql`ALTER TABLE eval_questions ADD CONSTRAINT ck_correct_key_questions CHECK (correct_key IN ('A','B','C','D','E'))`.execute(db);
	await sql`ALTER TABLE eval_questions ADD CONSTRAINT ck_score_questions CHECK (score_percent BETWEEN 0 AND 1)`.execute(db);

	await db.schema
		.createIndex('eval_questions_order_unique')
		.on('eval_questions')
		.columns(['eval_code', 'order_in_eval'])
		.unique()
		.execute();

	// Eval answers table
	await db.schema
		.createTable('eval_answers')
		.addColumn('code', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
		.addColumn('register_code', 'uuid', (col) => col.notNull().references('registers.code').onDelete('cascade'))
		.addColumn('question_code', 'uuid', (col) => col.notNull().references('eval_questions.code').onDelete('cascade'))
		.addColumn('student_answer', 'text')
		.execute();

	await sql`ALTER TABLE eval_answers ADD CONSTRAINT ck_eval_answers_answer CHECK (student_answer IN ('A','B','C','D','E', 'error_multiple') OR student_answer IS NULL)`.execute(db);

	await db.schema
		.createIndex('eval_answers_unique')
		.on('eval_answers')
		.columns(['register_code', 'question_code'])
		.unique()
		.execute();

	// Eval results table
	await db.schema
		.createTable('eval_results')
		.addColumn('code', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
		.addColumn('register_code', 'uuid', (col) => col.notNull().references('registers.code').onDelete('cascade'))
		.addColumn('eval_code', 'uuid', (col) => col.notNull().references('evals.code').onDelete('cascade'))
		.addColumn('section_code', 'uuid', (col) => col.references('eval_sections.code').onDelete('cascade'))
		.addColumn('correct_count', 'integer', (col) => col.notNull().defaultTo(0))
		.addColumn('blank_count', 'integer', (col) => col.notNull().defaultTo(0))
		.addColumn('incorrect_count', 'integer', (col) => col.notNull().defaultTo(0))
		.addColumn('score', sql`numeric(5,2)`, (col) => col.notNull().defaultTo(0.00))
		.addColumn('calculated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();

	await db.schema
		.createIndex('eval_results_unique')
		.on('eval_results')
		.columns(['register_code', 'eval_code', 'section_code'])
		.unique()
		.execute();

	// Create trigger function for updating updated_at
	await sql`
		CREATE OR REPLACE FUNCTION update_updated_at()
		RETURNS TRIGGER AS $$
		BEGIN
			NEW.updated_at = CURRENT_TIMESTAMP;
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;
	`.execute(db);

	// Apply triggers to tables with updated_at
	await sql`
		CREATE TRIGGER users_updated_at_trigger
			BEFORE UPDATE ON users
			FOR EACH ROW EXECUTE FUNCTION update_updated_at();
	`.execute(db);

	await sql`
		CREATE TRIGGER students_updated_at_trigger
			BEFORE UPDATE ON students
			FOR EACH ROW EXECUTE FUNCTION update_updated_at();
	`.execute(db);

	await sql`
		CREATE TRIGGER evals_updated_at_trigger
			BEFORE UPDATE ON evals
			FOR EACH ROW EXECUTE FUNCTION update_updated_at();
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('eval_results').execute();
	await db.schema.dropTable('eval_answers').execute();
	await db.schema.dropTable('eval_questions').execute();
	await db.schema.dropTable('eval_sections').execute();
	await db.schema.dropTable('evals').execute();
	await db.schema.dropTable('registers').execute();
	await db.schema.dropTable('students').execute();
	await db.schema.dropTable('courses').execute();
	await db.schema.dropTable('levels').execute();
	await db.schema.dropTable('permissions').execute();
	await db.schema.dropTable('users').execute();
	await sql`DROP FUNCTION IF EXISTS update_updated_at()`.execute(db);
}
