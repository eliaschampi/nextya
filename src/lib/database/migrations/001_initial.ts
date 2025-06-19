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
		.addColumn('created_at', 'timestamptz', (col) =>
			col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
		)
		.addColumn('updated_at', 'timestamptz', (col) =>
			col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
		)
		.execute();

	// Permissions table
	await db.schema
		.createTable('permissions')
		.addColumn('code', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
		.addColumn('user_code', 'uuid', (col) =>
			col.notNull().references('users.code').onDelete('cascade')
		)
		.addColumn('entity', 'varchar(50)', (col) => col.notNull())
		.addColumn('action', 'varchar(50)', (col) => col.notNull())
		.addColumn('created_at', 'timestamptz', (col) =>
			col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
		)
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
		.addColumn('user_code', 'uuid', (col) =>
			col.notNull().references('users.code').onDelete('cascade')
		)
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
		.addColumn('user_code', 'uuid', (col) =>
			col.notNull().references('users.code').onDelete('cascade')
		)
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
		.addColumn('student_code', 'uuid', (col) =>
			col.notNull().references('students.code').onDelete('cascade')
		)
		.addColumn('level_code', 'uuid', (col) =>
			col.notNull().references('levels.code').onDelete('cascade')
		)
		.addColumn('group_name', 'char(1)', (col) => col.notNull())
		.addColumn('user_code', 'uuid', (col) =>
			col.notNull().references('users.code').onDelete('cascade')
		)
		.addColumn('roll_code', 'char(4)', (col) => col.notNull())
		.addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();

	// Add constraints for registers
	await sql`ALTER TABLE registers ADD CONSTRAINT ck_registers_group CHECK (group_name IN ('A','B','C','D'))`.execute(
		db
	);

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

	await sql`ALTER TABLE evals ADD CONSTRAINT ck_evals_group CHECK (group_name IN ('A','B','C','D'))`.execute(
		db
	);

	// Eval sections table
	await db.schema
		.createTable('eval_sections')
		.addColumn('code', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
		.addColumn('eval_code', 'uuid', (col) =>
			col.notNull().references('evals.code').onDelete('cascade')
		)
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
		.addColumn('eval_code', 'uuid', (col) =>
			col.notNull().references('evals.code').onDelete('cascade')
		)
		.addColumn('section_code', 'uuid', (col) =>
			col.notNull().references('eval_sections.code').onDelete('cascade')
		)
		.addColumn('order_in_eval', 'integer', (col) => col.notNull())
		.addColumn('correct_key', 'char(1)', (col) => col.notNull())
		.addColumn('omitable', 'boolean', (col) => col.defaultTo(false))
		.addColumn('score_percent', sql`numeric(3,2)`, (col) => col.notNull().defaultTo(1.0))
		.execute();

	await sql`ALTER TABLE eval_questions ADD CONSTRAINT ck_correct_key_questions CHECK (correct_key IN ('A','B','C','D','E'))`.execute(
		db
	);
	await sql`ALTER TABLE eval_questions ADD CONSTRAINT ck_score_questions CHECK (score_percent BETWEEN 0 AND 1)`.execute(
		db
	);

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
		.addColumn('register_code', 'uuid', (col) =>
			col.notNull().references('registers.code').onDelete('cascade')
		)
		.addColumn('question_code', 'uuid', (col) =>
			col.notNull().references('eval_questions.code').onDelete('cascade')
		)
		.addColumn('student_answer', 'text')
		.execute();

	await sql`ALTER TABLE eval_answers ADD CONSTRAINT ck_eval_answers_answer CHECK (student_answer IN ('A','B','C','D','E', 'error_multiple') OR student_answer IS NULL)`.execute(
		db
	);

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
		.addColumn('register_code', 'uuid', (col) =>
			col.notNull().references('registers.code').onDelete('cascade')
		)
		.addColumn('eval_code', 'uuid', (col) =>
			col.notNull().references('evals.code').onDelete('cascade')
		)
		.addColumn('section_code', 'uuid', (col) =>
			col.references('eval_sections.code').onDelete('cascade')
		)
		.addColumn('correct_count', 'integer', (col) => col.notNull().defaultTo(0))
		.addColumn('blank_count', 'integer', (col) => col.notNull().defaultTo(0))
		.addColumn('incorrect_count', 'integer', (col) => col.notNull().defaultTo(0))
		.addColumn('score', sql`numeric(5,2)`, (col) => col.notNull().defaultTo(0.0))
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

	// Create performance indices
	await createIndices(db);

	// Create database functions
	await createDatabaseFunctions(db);

	// Create views
	await createViews(db);

	// Enable RLS and create policies
	await createPolicies(db);
}

// Helper function to create performance indices
async function createIndices(db: Kysely<any>): Promise<void> {
	// 1. Permissions table
	await sql`CREATE INDEX IF NOT EXISTS idx_permissions_user_code ON permissions(user_code)`.execute(
		db
	);
	await sql`CREATE INDEX IF NOT EXISTS idx_permissions_entity ON permissions(entity)`.execute(db);

	// 2. Students table
	await sql`CREATE INDEX IF NOT EXISTS idx_students_user_code ON students(user_code)`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_students_name_search ON students USING GIN (to_tsvector('english', name || ' ' || last_name))`.execute(
		db
	);

	// 3. Levels table
	await sql`CREATE INDEX IF NOT EXISTS idx_levels_name ON levels(name)`.execute(db);

	// 4. Courses table
	await sql`CREATE INDEX IF NOT EXISTS idx_courses_user_code ON courses(user_code)`.execute(db);

	// 5. Registers table
	await sql`CREATE INDEX IF NOT EXISTS idx_registers_student_code ON registers(student_code)`.execute(
		db
	);
	await sql`CREATE INDEX IF NOT EXISTS idx_registers_level_code ON registers(level_code)`.execute(
		db
	);
	await sql`CREATE INDEX IF NOT EXISTS idx_registers_user_code ON registers(user_code)`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_registers_group_level ON registers(group_name, level_code)`.execute(
		db
	);

	// 6. Evals table
	await sql`CREATE INDEX IF NOT EXISTS idx_evals_level_code ON evals(level_code)`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_evals_user_code ON evals(user_code)`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_evals_group_date ON evals(group_name, eval_date)`.execute(
		db
	);

	// 7. Eval sections table
	await sql`CREATE INDEX IF NOT EXISTS idx_eval_sections_eval_code ON eval_sections(eval_code)`.execute(
		db
	);
	await sql`CREATE INDEX IF NOT EXISTS idx_eval_sections_course_code ON eval_sections(course_code)`.execute(
		db
	);
	await sql`CREATE INDEX IF NOT EXISTS idx_eval_sections_order ON eval_sections(order_in_eval)`.execute(
		db
	);

	// 8. Eval questions table
	await sql`CREATE INDEX IF NOT EXISTS idx_eval_questions_eval_code ON eval_questions(eval_code)`.execute(
		db
	);
	await sql`CREATE INDEX IF NOT EXISTS idx_eval_questions_section_code ON eval_questions(section_code)`.execute(
		db
	);
	await sql`CREATE INDEX IF NOT EXISTS idx_eval_questions_order ON eval_questions(order_in_eval)`.execute(
		db
	);

	// 9. Eval answers table
	await sql`CREATE INDEX IF NOT EXISTS idx_eval_answers_register_code ON eval_answers(register_code)`.execute(
		db
	);
	await sql`CREATE INDEX IF NOT EXISTS idx_eval_answers_question_code ON eval_answers(question_code)`.execute(
		db
	);
	await sql`CREATE INDEX IF NOT EXISTS idx_eval_answers_student_answer ON eval_answers(student_answer) WHERE student_answer IS NOT NULL`.execute(
		db
	);

	// 10. Eval results table
	await sql`CREATE INDEX IF NOT EXISTS idx_eval_results_register_code ON eval_results(register_code)`.execute(
		db
	);
	await sql`CREATE INDEX IF NOT EXISTS idx_eval_results_eval_code ON eval_results(eval_code)`.execute(
		db
	);
	await sql`CREATE INDEX IF NOT EXISTS idx_eval_results_section_code ON eval_results(section_code) WHERE section_code IS NOT NULL`.execute(
		db
	);
	await sql`CREATE INDEX IF NOT EXISTS idx_eval_results_score ON eval_results(score)`.execute(db);
}

// Helper function to create database functions
async function createDatabaseFunctions(db: Kysely<any>): Promise<void> {
	// 1. Upsert eval results function
	await sql`
		CREATE OR REPLACE FUNCTION upsert_eval_results(
			p_eval_code uuid,
			p_register_code uuid,
			p_answers jsonb,
			p_general_result jsonb,
			p_section_results jsonb
		)
		RETURNS void AS $$
		DECLARE
			v_answer record;
			v_section_code uuid;
			v_section_result jsonb;
		BEGIN
			-- Delete previous answers and results
			DELETE FROM eval_answers
			WHERE register_code = p_register_code
			  AND question_code IN (SELECT code FROM eval_questions WHERE eval_code = p_eval_code);

			DELETE FROM eval_results
			WHERE register_code = p_register_code
			  AND eval_code = p_eval_code;

			-- Insert new answers
			FOR v_answer IN SELECT * FROM jsonb_to_recordset(p_answers) AS x(question_code uuid, student_answer text)
			LOOP
				INSERT INTO eval_answers (register_code, question_code, student_answer)
				VALUES (p_register_code, v_answer.question_code, v_answer.student_answer);
			END LOOP;

			-- Insert general result
			INSERT INTO eval_results (register_code, eval_code, section_code, correct_count, incorrect_count, blank_count, score)
			VALUES (
				p_register_code,
				p_eval_code,
				NULL,
				(p_general_result->>'correct_count')::int,
				(p_general_result->>'incorrect_count')::int,
				(p_general_result->>'blank_count')::int,
				(p_general_result->>'score')::numeric
			);

			-- Insert section results
			FOR v_section_code, v_section_result IN SELECT * FROM jsonb_each(p_section_results)
			LOOP
				INSERT INTO eval_results (register_code, eval_code, section_code, correct_count, incorrect_count, blank_count, score)
				VALUES (
					p_register_code,
					p_eval_code,
					v_section_code,
					(v_section_result->>'correct_count')::int,
					(v_section_result->>'incorrect_count')::int,
					(v_section_result->>'blank_count')::int,
					(v_section_result->>'score')::numeric
				);
			END LOOP;
		END;
		$$ LANGUAGE plpgsql;
	`.execute(db);

	// 2. Import student register function
	await sql`
		CREATE OR REPLACE FUNCTION import_student_register(
		  p_name TEXT,
		  p_last_name TEXT,
		  p_phone TEXT,
		  p_email TEXT,
		  p_level_code UUID,
		  p_group_name TEXT,
		  p_roll_code TEXT,
		  p_user_code UUID
		) RETURNS VOID AS $$
		DECLARE
		  v_student_code UUID;
		  v_existing_student_code UUID;
		BEGIN
		  -- Validate group_name
		  IF p_group_name NOT IN ('A', 'B', 'C', 'D') THEN
			RAISE EXCEPTION 'Invalid group_name: %. Must be one of A, B, C, D', p_group_name;
		  END IF;

		  -- Normalize inputs
		  p_name := TRIM(p_name);
		  p_last_name := TRIM(p_last_name);
		  p_phone := NULLIF(TRIM(p_phone), '');
		  p_email := NULLIF(TRIM(p_email), '');
		  p_roll_code := TRIM(p_roll_code);

		  -- Look for existing student
		  SELECT code INTO v_existing_student_code
		  FROM students
		  WHERE (name = p_name AND last_name = p_last_name)
			 OR (p_email IS NOT NULL AND email = p_email);

		  -- Process student record
		  IF v_existing_student_code IS NOT NULL THEN
			v_student_code := v_existing_student_code;
			-- Update student data if needed
			UPDATE students
			SET
			  phone = COALESCE(p_phone, phone),
			  email = COALESCE(p_email, email)
			WHERE code = v_student_code;
		  ELSE
			-- Insert new student
			INSERT INTO students (name, last_name, phone, email, user_code)
			VALUES (p_name, p_last_name, p_phone, p_email, p_user_code)
			RETURNING code INTO v_student_code;
		  END IF;

		  -- Process register record
		  INSERT INTO registers (student_code, level_code, group_name, roll_code, user_code)
		  VALUES (v_student_code, p_level_code, p_group_name, p_roll_code, p_user_code)
		  ON CONFLICT (student_code, level_code, group_name)
		  DO UPDATE SET roll_code = EXCLUDED.roll_code;
		END;
		$$ LANGUAGE plpgsql;
	`.execute(db);

	// 3. Get register eval results function
	await sql`
		CREATE OR REPLACE FUNCTION get_register_eval_results(p_eval_code TEXT)
		RETURNS TABLE (
			result_code TEXT,
			register_code TEXT,
			eval_code TEXT,
			section_code TEXT,
			correct_count INTEGER,
			incorrect_count INTEGER,
			blank_count INTEGER,
			score NUMERIC,
			calculated_at TIMESTAMP WITH TIME ZONE,
			student_code TEXT,
			roll_code TEXT,
			group_name TEXT,
			level_code TEXT,
			name TEXT,
			last_name TEXT,
			level_name TEXT
		) LANGUAGE SQL SECURITY DEFINER AS $$
			SELECT
				er.code AS result_code,
				er.register_code,
				er.eval_code,
				er.section_code,
				er.correct_count,
				er.incorrect_count,
				er.blank_count,
				er.score,
				er.calculated_at,
				r.student_code,
				r.roll_code,
				r.group_name,
				r.level_code,
				s.name,
				s.last_name,
				l.name AS level_name
			FROM
				eval_results er
				INNER JOIN registers r ON er.register_code = r.code
				INNER JOIN students s ON r.student_code = s.code
				INNER JOIN levels l ON r.level_code = l.code
			WHERE
				er.eval_code = p_eval_code::UUID
				AND er.section_code IS NULL
			ORDER BY
				er.score DESC;
		$$;
	`.execute(db);

	// 4. Level course scores function
	await sql`
		CREATE OR REPLACE FUNCTION get_level_course_scores(p_level_code TEXT, p_group_name TEXT)
		RETURNS TABLE (
			course_code TEXT,
			course_name VARCHAR,
			average_score NUMERIC
		) LANGUAGE plpgsql SECURITY DEFINER AS $$
		BEGIN
			RETURN QUERY
			WITH course_results AS (
				SELECT
					es.course_code,
					c.name AS course_name,
					er.score
				FROM
					eval_results er
					JOIN eval_sections es ON er.section_code = es.code
					JOIN courses c ON es.course_code = c.code
					JOIN registers r ON er.register_code = r.code
				WHERE
					r.level_code = p_level_code::UUID
					AND r.group_name = p_group_name
					AND er.section_code IS NOT NULL
			),
			course_averages AS (
				SELECT
					cr.course_code,
					cr.course_name,
					AVG(cr.score) AS average_score
				FROM
					course_results cr
				GROUP BY
					cr.course_code, cr.course_name
			)
			SELECT
				ca.course_code::TEXT,
				ca.course_name,
				ROUND(ca.average_score, 2) AS average_score
			FROM
				course_averages ca
			ORDER BY
				ca.course_name;
		END;
		$$;
	`.execute(db);

	// 5. Course eval scores function
	await sql`
		CREATE OR REPLACE FUNCTION get_course_eval_scores(
			p_level_code TEXT,
			p_course_code TEXT,
			p_group_name TEXT
		)
		RETURNS TABLE (
			eval_code TEXT,
			eval_name VARCHAR,
			eval_date DATE,
			average_score NUMERIC
		) LANGUAGE plpgsql SECURITY DEFINER AS $$
		BEGIN
			RETURN QUERY
			WITH eval_results_data AS (
				SELECT
					e.code AS eval_code,
					e.name AS eval_name,
					e.eval_date,
					er.score
				FROM
					eval_results er
					JOIN eval_sections es ON er.section_code = es.code
					JOIN evals e ON er.eval_code = e.code
					JOIN registers r ON er.register_code = r.code
				WHERE
					r.level_code = p_level_code::UUID
					AND r.group_name = p_group_name
					AND es.course_code = p_course_code::UUID
					AND er.section_code IS NOT NULL
			),
			eval_averages AS (
				SELECT
					erd.eval_code,
					erd.eval_name,
					erd.eval_date,
					AVG(erd.score) AS average_score
				FROM
					eval_results_data erd
				GROUP BY
					erd.eval_code, erd.eval_name, erd.eval_date
			)
			SELECT
				ea.eval_code::TEXT,
				ea.eval_name,
				ea.eval_date,
				ROUND(ea.average_score, 2) AS average_score
			FROM
				eval_averages ea
			ORDER BY
				ea.eval_date ASC;
		END;
		$$;
	`.execute(db);
}

// Helper function to create views
async function createViews(db: Kysely<any>): Promise<void> {
	// Student register results view
	await sql`
		CREATE OR REPLACE VIEW student_register_results AS
		SELECT
			er.code AS result_code,
			er.register_code,
			er.eval_code,
			er.correct_count,
			er.incorrect_count,
			er.blank_count,
			er.score,
			er.calculated_at,
			r.student_code,
			r.roll_code,
			r.group_name AS register_group_name,
			r.level_code,
			s.name AS student_name,
			s.last_name AS student_last_name,
			l.name AS level_name,
			e.name AS eval_name,
			e.eval_date
		FROM
			eval_results er
			JOIN registers r ON er.register_code = r.code
			JOIN students s ON r.student_code = s.code
			JOIN levels l ON r.level_code = l.code
			JOIN evals e ON er.eval_code = e.code
		WHERE
			er.section_code IS NULL;
	`.execute(db);
}

// Helper function to create policies (Note: These are Supabase-style policies, may need adaptation for self-hosted PostgreSQL)
async function createPolicies(db: Kysely<any>): Promise<void> {
	// Enable RLS on all tables
	await sql`ALTER TABLE users ENABLE ROW LEVEL SECURITY`.execute(db);
	await sql`ALTER TABLE permissions ENABLE ROW LEVEL SECURITY`.execute(db);
	await sql`ALTER TABLE levels ENABLE ROW LEVEL SECURITY`.execute(db);
	await sql`ALTER TABLE courses ENABLE ROW LEVEL SECURITY`.execute(db);
	await sql`ALTER TABLE students ENABLE ROW LEVEL SECURITY`.execute(db);
	await sql`ALTER TABLE registers ENABLE ROW LEVEL SECURITY`.execute(db);
	await sql`ALTER TABLE evals ENABLE ROW LEVEL SECURITY`.execute(db);
	await sql`ALTER TABLE eval_sections ENABLE ROW LEVEL SECURITY`.execute(db);
	await sql`ALTER TABLE eval_questions ENABLE ROW LEVEL SECURITY`.execute(db);
	await sql`ALTER TABLE eval_answers ENABLE ROW LEVEL SECURITY`.execute(db);
	await sql`ALTER TABLE eval_results ENABLE ROW LEVEL SECURITY`.execute(db);

	// Create has_permission function for policies
	await sql`
		CREATE OR REPLACE FUNCTION has_permission(entity_name TEXT, action_name TEXT)
		RETURNS BOOLEAN AS $$
		DECLARE
			user_id UUID;
		BEGIN
			-- Get current user ID (this would need to be adapted for your auth system)
			-- For now, we'll return true to allow all operations
			-- You'll need to implement proper user context detection
			RETURN true;
		END;
		$$ LANGUAGE plpgsql SECURITY DEFINER;
	`.execute(db);

	// Levels policies
	await sql`
		CREATE POLICY "Users_can_view_levels" ON levels FOR SELECT
		USING (has_permission('levels', 'read'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_insert_level" ON levels FOR INSERT
		WITH CHECK (has_permission('levels', 'create'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_update_level" ON levels FOR UPDATE
		USING (has_permission('levels', 'update'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_del_level" ON levels FOR DELETE
		USING (has_permission('levels', 'delete'));
	`.execute(db);

	// Courses policies
	await sql`
		CREATE POLICY "Users_can_view_courses" ON courses FOR SELECT
		USING (has_permission('courses', 'read'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_insert_course" ON courses FOR INSERT
		WITH CHECK (has_permission('courses', 'create'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_update_course" ON courses FOR UPDATE
		USING (has_permission('courses', 'update'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_del_course" ON courses FOR DELETE
		USING (has_permission('courses', 'delete'));
	`.execute(db);

	// Students policies
	await sql`
		CREATE POLICY "Users_can_view_students" ON students FOR SELECT
		USING (has_permission('students', 'read'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_insert_student" ON students FOR INSERT
		WITH CHECK (has_permission('students', 'create'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_update_student" ON students FOR UPDATE
		USING (has_permission('students', 'update'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_del_student" ON students FOR DELETE
		USING (has_permission('students', 'delete'));
	`.execute(db);

	// Registers policies
	await sql`
		CREATE POLICY "Users_can_view_registers" ON registers FOR SELECT
		USING (has_permission('registers', 'read'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_insert_register" ON registers FOR INSERT
		WITH CHECK (has_permission('registers', 'create'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_update_register" ON registers FOR UPDATE
		USING (has_permission('registers', 'update'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_del_register" ON registers FOR DELETE
		USING (has_permission('registers', 'delete'));
	`.execute(db);

	// Evals policies
	await sql`
		CREATE POLICY "Users_can_view_evals" ON evals FOR SELECT
		USING (has_permission('evals', 'read'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_insert_eval" ON evals FOR INSERT
		WITH CHECK (has_permission('evals', 'create'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_update_eval" ON evals FOR UPDATE
		USING (has_permission('evals', 'update'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_del_eval" ON evals FOR DELETE
		USING (has_permission('evals', 'delete'));
	`.execute(db);

	// Eval sections policies
	await sql`
		CREATE POLICY "Users_can_view_eval_sections" ON eval_sections FOR SELECT
		USING (has_permission('eval_sections', 'read'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_insert_eval_section" ON eval_sections FOR INSERT
		WITH CHECK (has_permission('eval_sections', 'create'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_update_eval_section" ON eval_sections FOR UPDATE
		USING (has_permission('eval_sections', 'update'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_del_eval_section" ON eval_sections FOR DELETE
		USING (has_permission('eval_sections', 'delete'));
	`.execute(db);

	// Eval questions policies
	await sql`
		CREATE POLICY "Users_can_view_eval_questions" ON eval_questions FOR SELECT
		USING (has_permission('eval_questions', 'read'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_insert_eval_question" ON eval_questions FOR INSERT
		WITH CHECK (has_permission('eval_questions', 'create'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_update_eval_question" ON eval_questions FOR UPDATE
		USING (has_permission('eval_questions', 'update'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_del_eval_question" ON eval_questions FOR DELETE
		USING (has_permission('eval_questions', 'delete'));
	`.execute(db);

	// Eval answers policies
	await sql`
		CREATE POLICY "Users_can_view_eval_answers" ON eval_answers FOR SELECT
		USING (has_permission('eval_answers', 'read'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_insert_eval_answer" ON eval_answers FOR INSERT
		WITH CHECK (has_permission('eval_answers', 'create'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_update_eval_answer" ON eval_answers FOR UPDATE
		USING (has_permission('eval_answers', 'update'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_del_eval_answer" ON eval_answers FOR DELETE
		USING (has_permission('eval_answers', 'delete'));
	`.execute(db);

	// Eval results policies
	await sql`
		CREATE POLICY "Users_can_view_eval_results" ON eval_results FOR SELECT
		USING (has_permission('eval_results', 'read'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_insert_eval_result" ON eval_results FOR INSERT
		WITH CHECK (has_permission('eval_results', 'create'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_update_eval_result" ON eval_results FOR UPDATE
		USING (has_permission('eval_results', 'update'));
	`.execute(db);

	await sql`
		CREATE POLICY "users_can_del_eval_result" ON eval_results FOR DELETE
		USING (has_permission('eval_results', 'delete'));
	`.execute(db);

	// Permissions policies
	await sql`
		CREATE POLICY "Users_can_view_permissions" ON permissions FOR SELECT
		USING (true);
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	// Drop views
	await sql`DROP VIEW IF EXISTS student_register_results`.execute(db);

	// Drop functions
	await sql`DROP FUNCTION IF EXISTS upsert_eval_results(uuid, uuid, jsonb, jsonb, jsonb)`.execute(
		db
	);
	await sql`DROP FUNCTION IF EXISTS import_student_register(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, UUID)`.execute(
		db
	);
	await sql`DROP FUNCTION IF EXISTS get_register_eval_results(TEXT)`.execute(db);
	await sql`DROP FUNCTION IF EXISTS get_level_course_scores(TEXT, TEXT)`.execute(db);
	await sql`DROP FUNCTION IF EXISTS get_course_eval_scores(TEXT, TEXT, TEXT)`.execute(db);
	await sql`DROP FUNCTION IF EXISTS has_permission(TEXT, TEXT)`.execute(db);

	// Drop tables (in reverse order of dependencies)
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

	// Drop trigger function
	await sql`DROP FUNCTION IF EXISTS update_updated_at()`.execute(db);
}
