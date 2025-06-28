-- PostgreSQL initialization for NextYa migration
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (replacing auth.users)
CREATE TABLE users (
  code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(100),
  last_name VARCHAR(150),
  photo_url TEXT,
  last_login TIMESTAMPTZ,
  is_email_verified BOOLEAN NOT NULL DEFAULT false,
  is_super_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE permissions (
  code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_code UUID NOT NULL REFERENCES users(code) ON DELETE CASCADE,
  entity VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_code, entity, action)
);

-- Levels table
CREATE TABLE levels (
  code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  abr TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  users UUID[] NOT NULL DEFAULT '{}'
);

-- Courses table
CREATE TABLE courses (
  code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  user_code UUID NOT NULL REFERENCES users(code) ON DELETE CASCADE,
  abr TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Students table
CREATE TABLE students (
  code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  last_name VARCHAR(150) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(100),
  user_code UUID NOT NULL REFERENCES users(code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, last_name)
);

-- Registers table
CREATE TABLE registers (
  code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code UUID NOT NULL REFERENCES students(code) ON DELETE CASCADE,
  level_code UUID NOT NULL REFERENCES levels(code) ON DELETE CASCADE,
  group_name CHAR(1) NOT NULL CHECK (group_name IN ('A','B','C','D')),
  user_code UUID NOT NULL REFERENCES users(code) ON DELETE CASCADE,
  roll_code CHAR(4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_code, level_code, group_name),
  UNIQUE(level_code, roll_code)
);

-- Evals table
CREATE TABLE evals (
  code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  level_code UUID NOT NULL REFERENCES levels(code),
  group_name CHAR(1) NOT NULL CHECK (group_name IN ('A','B','C','D')),
  eval_date DATE NOT NULL,
  user_code UUID NOT NULL REFERENCES users(code),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Eval sections table
CREATE TABLE eval_sections (
  code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_code UUID NOT NULL REFERENCES evals(code) ON DELETE CASCADE,
  course_code UUID NOT NULL REFERENCES courses(code),
  order_in_eval INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  UNIQUE(eval_code, course_code),
  UNIQUE(eval_code, order_in_eval)
);

-- Eval questions table
CREATE TABLE eval_questions (
  code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_code UUID NOT NULL REFERENCES evals(code) ON DELETE CASCADE,
  section_code UUID NOT NULL REFERENCES eval_sections(code) ON DELETE CASCADE,
  order_in_eval INTEGER NOT NULL,
  correct_key CHAR(1) NOT NULL CHECK (correct_key IN ('A','B','C','D','E')),
  omitable BOOLEAN DEFAULT FALSE,
  score_percent NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (score_percent BETWEEN 0 AND 1),
  UNIQUE(eval_code, order_in_eval)
);

-- Eval answers table
CREATE TABLE eval_answers (
  code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_code UUID NOT NULL REFERENCES registers(code) ON DELETE CASCADE,
  question_code UUID NOT NULL REFERENCES eval_questions(code) ON DELETE CASCADE,
  student_answer TEXT CHECK (student_answer IN ('A','B','C','D','E', 'error_multiple') OR student_answer IS NULL),
  UNIQUE(register_code, question_code)
);

-- Eval results table
CREATE TABLE eval_results (
  code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_code UUID NOT NULL REFERENCES registers(code) ON DELETE CASCADE,
  eval_code UUID NOT NULL REFERENCES evals(code) ON DELETE CASCADE,
  section_code UUID REFERENCES eval_sections(code) ON DELETE CASCADE,
  correct_count INTEGER NOT NULL DEFAULT 0,
  blank_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(register_code, eval_code, section_code)
);

-- Trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
CREATE TRIGGER users_updated_at_trigger
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER students_updated_at_trigger
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER evals_updated_at_trigger
  BEFORE UPDATE ON evals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_permissions_user_code ON permissions(user_code);
CREATE INDEX IF NOT EXISTS idx_permissions_entity ON permissions(entity);
CREATE INDEX IF NOT EXISTS idx_students_user_code ON students(user_code);
CREATE INDEX IF NOT EXISTS idx_students_name_search ON students USING GIN (to_tsvector('english', name || ' ' || last_name));
CREATE INDEX IF NOT EXISTS idx_levels_name ON levels(name);
CREATE INDEX IF NOT EXISTS idx_courses_user_code ON courses(user_code);
CREATE INDEX IF NOT EXISTS idx_registers_student_code ON registers(student_code);
CREATE INDEX IF NOT EXISTS idx_registers_level_code ON registers(level_code);
CREATE INDEX IF NOT EXISTS idx_registers_user_code ON registers(user_code);
CREATE INDEX IF NOT EXISTS idx_registers_group_level ON registers(group_name, level_code);
CREATE INDEX IF NOT EXISTS idx_evals_level_code ON evals(level_code);
CREATE INDEX IF NOT EXISTS idx_evals_user_code ON evals(user_code);
CREATE INDEX IF NOT EXISTS idx_evals_group_date ON evals(group_name, eval_date);
CREATE INDEX IF NOT EXISTS idx_eval_sections_eval_code ON eval_sections(eval_code);
CREATE INDEX IF NOT EXISTS idx_eval_sections_course_code ON eval_sections(course_code);
CREATE INDEX IF NOT EXISTS idx_eval_sections_order ON eval_sections(order_in_eval);
CREATE INDEX IF NOT EXISTS idx_eval_questions_eval_code ON eval_questions(eval_code);
CREATE INDEX IF NOT EXISTS idx_eval_questions_section_code ON eval_questions(section_code);
CREATE INDEX IF NOT EXISTS idx_eval_questions_order ON eval_questions(order_in_eval);
CREATE INDEX IF NOT EXISTS idx_eval_answers_register_code ON eval_answers(register_code);
CREATE INDEX IF NOT EXISTS idx_eval_answers_question_code ON eval_answers(question_code);
CREATE INDEX IF NOT EXISTS idx_eval_answers_student_answer ON eval_answers(student_answer) WHERE student_answer IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eval_results_register_code ON eval_results(register_code);
CREATE INDEX IF NOT EXISTS idx_eval_results_eval_code ON eval_results(eval_code);
CREATE INDEX IF NOT EXISTS idx_eval_results_section_code ON eval_results(section_code) WHERE section_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eval_results_score ON eval_results(score);

-- Essential database functions

-- 1. Upsert eval results function
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

-- 2. Import student register function
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

-- 3. Student evaluation report function (for CSV export)
CREATE OR REPLACE FUNCTION get_student_eval_report(p_student_code TEXT)
RETURNS TABLE (
    eval_code TEXT,
    eval_name VARCHAR,
    eval_date DATE,
    register_code TEXT,
    result_code TEXT,
    score NUMERIC,
    correct_count INTEGER,
    incorrect_count INTEGER,
    blank_count INTEGER,
    course_scores JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH student_eval_results AS (
        -- Get general evaluation results for the student
        SELECT
            er.eval_code,
            e.name AS eval_name,
            e.eval_date,
            er.register_code,
            er.code AS result_code,
            er.score,
            er.correct_count,
            er.incorrect_count,
            er.blank_count
        FROM
            eval_results er
            JOIN registers r ON er.register_code = r.code
            JOIN evals e ON er.eval_code = e.code
        WHERE
            r.student_code = p_student_code::UUID
            AND er.section_code IS NULL
    ),
    course_scores_data AS (
        -- Get course-specific scores for each evaluation
        SELECT
            er.eval_code,
            jsonb_object_agg(
                c.name,
                jsonb_build_object(
                    'score', er.score,
                    'correct', er.correct_count,
                    'incorrect', er.incorrect_count,
                    'blank', er.blank_count
                )
            ) AS course_scores
        FROM
            eval_results er
            JOIN eval_sections es ON er.section_code = es.code
            JOIN courses c ON es.course_code = c.code
            JOIN registers r ON er.register_code = r.code
        WHERE
            r.student_code = p_student_code::UUID
            AND er.section_code IS NOT NULL
        GROUP BY
            er.eval_code
    )
    SELECT
        ser.eval_code::TEXT,
        ser.eval_name,
        ser.eval_date,
        ser.register_code::TEXT,
        ser.result_code::TEXT,
        ser.score,
        ser.correct_count,
        ser.incorrect_count,
        ser.blank_count,
        COALESCE(csd.course_scores, '{}'::jsonb) AS course_scores
    FROM
        student_eval_results ser
        LEFT JOIN course_scores_data csd ON ser.eval_code = csd.eval_code
    ORDER BY
        ser.eval_date DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. Student register results view
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