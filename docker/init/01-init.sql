-- =====================================================
-- NextYa Database Schema - Clean Kysely Architecture
-- =====================================================
-- This schema exactly matches the Supabase migration structure
-- but with clean architecture and consistent naming conventions
-- =====================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set configuration
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE public.entity_enum AS ENUM (
    'users',
    'levels',
    'courses',
    'students',
    'registers',
    'evals',
    'eval_sections',
    'eval_questions',
    'eval_answers',
    'eval_results'
);

-- =====================================================
-- TABLES
-- =====================================================

-- Users table (clean implementation without Supabase auth)
CREATE TABLE public.users (
    code UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    email VARCHAR(255) NOT NULL,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    last_login TIMESTAMPTZ NULL,
    last_name VARCHAR(150) NULL,
    name VARCHAR(100) NULL,
    password_hash VARCHAR(255) NOT NULL,
    photo_url TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_pk PRIMARY KEY (code),
    CONSTRAINT users_email_uq UNIQUE (email)
);

-- Permissions table
CREATE TABLE public.permissions (
    code UUID NOT NULL DEFAULT gen_random_uuid(),
    user_code UUID NOT NULL,
    entity entity_enum NOT NULL,
    action VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT permissions_pk PRIMARY KEY (code),
    CONSTRAINT permissions_user_fk FOREIGN KEY (user_code) REFERENCES public.users(code) ON DELETE CASCADE,
    CONSTRAINT permissions_entity_user_action_uq UNIQUE (entity, user_code, action)
);

-- Levels table
CREATE TABLE public.levels (
    code UUID NOT NULL DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    abr TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    users UUID[] NOT NULL,
    CONSTRAINT levels_pk PRIMARY KEY (code)
);

-- Courses table (abr field was removed in migration 20251212000008)
CREATE TABLE public.courses (
    code UUID NOT NULL DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    user_code UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT courses_pk PRIMARY KEY (code),
    CONSTRAINT courses_user_fk FOREIGN KEY (user_code) REFERENCES public.users(code) ON DELETE CASCADE
);

-- Students table
CREATE TABLE public.students (
    code UUID NOT NULL DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(100) NULL,
    user_code UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT students_pk PRIMARY KEY (code),
    CONSTRAINT students_user_fk FOREIGN KEY (user_code) REFERENCES public.users(code) ON DELETE CASCADE,
    CONSTRAINT students_name_lastname_uq UNIQUE (name, last_name)
);

-- Registers table
CREATE TABLE public.registers (
    code UUID NOT NULL DEFAULT gen_random_uuid(),
    student_code UUID NOT NULL,
    level_code UUID NOT NULL,
    group_name CHAR(1) NOT NULL,
    user_code UUID NOT NULL,
    roll_code CHAR(4) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT registers_pk PRIMARY KEY (code),
    CONSTRAINT registers_student_fk FOREIGN KEY (student_code) REFERENCES public.students(code) ON DELETE CASCADE,
    CONSTRAINT registers_level_fk FOREIGN KEY (level_code) REFERENCES public.levels(code) ON DELETE CASCADE,
    CONSTRAINT registers_user_fk FOREIGN KEY (user_code) REFERENCES public.users(code) ON DELETE CASCADE,
    CONSTRAINT registers_student_level_group_uq UNIQUE (student_code, level_code, group_name),
    CONSTRAINT registers_roll_code_uq UNIQUE (level_code, roll_code),
    CONSTRAINT registers_group_ck CHECK (group_name IN ('A','B','C','D'))
);

-- Evals table
CREATE TABLE public.evals (
    code UUID NOT NULL DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    level_code UUID NOT NULL,
    group_name CHAR(1) NOT NULL,
    eval_date DATE NOT NULL,
    user_code UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT evals_pk PRIMARY KEY (code),
    CONSTRAINT evals_level_fk FOREIGN KEY (level_code) REFERENCES public.levels(code),
    CONSTRAINT evals_user_fk FOREIGN KEY (user_code) REFERENCES public.users(code),
    CONSTRAINT evals_group_ck CHECK (group_name IN ('A','B','C','D'))
);

-- Eval sections table
CREATE TABLE public.eval_sections (
    code UUID NOT NULL DEFAULT gen_random_uuid(),
    eval_code UUID NOT NULL,
    course_code UUID NOT NULL,
    order_in_eval INT NOT NULL,
    question_count INT NOT NULL,
    CONSTRAINT eval_sections_pk PRIMARY KEY (code),
    CONSTRAINT eval_sections_eval_fk FOREIGN KEY (eval_code) REFERENCES public.evals(code) ON DELETE CASCADE,
    CONSTRAINT eval_sections_course_fk FOREIGN KEY (course_code) REFERENCES public.courses(code),
    CONSTRAINT eval_sections_eval_course_uq UNIQUE (eval_code, course_code),
    CONSTRAINT eval_sections_eval_order_uq UNIQUE (eval_code, order_in_eval)
);

-- Eval questions table
CREATE TABLE public.eval_questions (
    code UUID NOT NULL DEFAULT gen_random_uuid(),
    eval_code UUID NOT NULL,
    section_code UUID NOT NULL,
    order_in_eval INT NOT NULL,
    correct_key CHAR(1) NOT NULL,
    omitable BOOLEAN DEFAULT FALSE,
    score_percent NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    CONSTRAINT eval_questions_pk PRIMARY KEY (code),
    CONSTRAINT eval_questions_eval_fk FOREIGN KEY (eval_code) REFERENCES public.evals(code) ON DELETE CASCADE,
    CONSTRAINT eval_questions_section_fk FOREIGN KEY (section_code) REFERENCES public.eval_sections(code) ON DELETE CASCADE,
    CONSTRAINT eval_questions_order_uq UNIQUE (eval_code, order_in_eval),
    CONSTRAINT eval_questions_correct_key_ck CHECK (correct_key IN ('A','B','C','D','E')),
    CONSTRAINT eval_questions_score_ck CHECK (score_percent BETWEEN 0 AND 1)
);

-- Eval answers table
CREATE TABLE public.eval_answers (
    code UUID NOT NULL DEFAULT gen_random_uuid(),
    register_code UUID NOT NULL,
    question_code UUID NOT NULL,
    student_answer TEXT NULL,
    CONSTRAINT eval_answers_pk PRIMARY KEY (code),
    CONSTRAINT eval_answers_register_fk FOREIGN KEY (register_code) REFERENCES public.registers(code) ON DELETE CASCADE,
    CONSTRAINT eval_answers_question_fk FOREIGN KEY (question_code) REFERENCES public.eval_questions(code) ON DELETE CASCADE,
    CONSTRAINT eval_answers_unique_uq UNIQUE (register_code, question_code),
    CONSTRAINT eval_answers_answer_ck CHECK (student_answer IN ('A','B','C','D','E', 'error_multiple') OR student_answer IS NULL)
);

-- Eval results table
CREATE TABLE public.eval_results (
    code UUID NOT NULL DEFAULT gen_random_uuid(),
    register_code UUID NOT NULL,
    eval_code UUID NOT NULL,
    section_code UUID NULL,
    correct_count INT NOT NULL DEFAULT 0,
    blank_count INT NOT NULL DEFAULT 0,
    incorrect_count INT NOT NULL DEFAULT 0,
    score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT eval_results_pk PRIMARY KEY (code),
    CONSTRAINT eval_results_register_fk FOREIGN KEY (register_code) REFERENCES public.registers(code) ON DELETE CASCADE,
    CONSTRAINT eval_results_eval_fk FOREIGN KEY (eval_code) REFERENCES public.evals(code) ON DELETE CASCADE,
    CONSTRAINT eval_results_section_fk FOREIGN KEY (section_code) REFERENCES public.eval_sections(code) ON DELETE CASCADE,
    CONSTRAINT eval_results_unique_uq UNIQUE (register_code, eval_code, section_code)
);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to verify permissions (simplified for clean architecture)
CREATE OR REPLACE FUNCTION public.has_permission(entity_name TEXT, permission TEXT) RETURNS BOOLEAN AS $$
BEGIN
    -- For clean architecture, we'll implement a simple permission check
    -- This can be enhanced with proper session management later
    RETURN TRUE; -- Simplified for now - implement proper auth logic as needed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Timestamp updater function
CREATE OR REPLACE FUNCTION public.timestamp_updater()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Users table trigger
CREATE TRIGGER users_updated_at_tg
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.timestamp_updater();

-- Students table trigger
CREATE TRIGGER students_updated_at_tg
BEFORE UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.timestamp_updater();

-- Evals table trigger
CREATE TRIGGER evals_updated_at_tg
BEFORE UPDATE ON public.evals
FOR EACH ROW
EXECUTE FUNCTION public.timestamp_updater();

-- =====================================================
-- INDEXES
-- =====================================================

-- Users table indexes
CREATE INDEX users_email_idx ON public.users(email);

-- Permissions table indexes
CREATE INDEX permissions_user_code_idx ON public.permissions(user_code);
CREATE INDEX permissions_entity_idx ON public.permissions(entity);

-- Students table indexes
CREATE INDEX students_user_code_idx ON public.students(user_code);
CREATE INDEX students_name_search_idx ON public.students USING GIN (to_tsvector('english', name || ' ' || last_name));

-- Levels table indexes
CREATE INDEX levels_name_idx ON public.levels(name);

-- Courses table indexes
CREATE INDEX courses_user_code_idx ON public.courses(user_code);

-- Registers table indexes
CREATE INDEX registers_student_code_idx ON public.registers(student_code);
CREATE INDEX registers_level_code_idx ON public.registers(level_code);
CREATE INDEX registers_user_code_idx ON public.registers(user_code);
CREATE INDEX registers_group_level_idx ON public.registers(group_name, level_code);

-- Evals table indexes
CREATE INDEX evals_level_code_idx ON public.evals(level_code);
CREATE INDEX evals_user_code_idx ON public.evals(user_code);
CREATE INDEX evals_group_date_idx ON public.evals(group_name, eval_date);

-- Eval sections table indexes
CREATE INDEX eval_sections_eval_code_idx ON public.eval_sections(eval_code);
CREATE INDEX eval_sections_course_code_idx ON public.eval_sections(course_code);
CREATE INDEX eval_sections_order_idx ON public.eval_sections(order_in_eval);

-- Eval questions table indexes
CREATE INDEX eval_questions_eval_code_idx ON public.eval_questions(eval_code);
CREATE INDEX eval_questions_section_code_idx ON public.eval_questions(section_code);
CREATE INDEX eval_questions_order_idx ON public.eval_questions(order_in_eval);

-- Eval answers table indexes
CREATE INDEX eval_answers_register_code_idx ON public.eval_answers(register_code);
CREATE INDEX eval_answers_question_code_idx ON public.eval_answers(question_code);
CREATE INDEX eval_answers_student_answer_idx ON public.eval_answers(student_answer) WHERE student_answer IS NOT NULL;

-- Eval results table indexes
CREATE INDEX eval_results_register_code_idx ON public.eval_results(register_code);
CREATE INDEX eval_results_eval_code_idx ON public.eval_results(eval_code);
CREATE INDEX eval_results_section_code_idx ON public.eval_results(section_code) WHERE section_code IS NOT NULL;
CREATE INDEX eval_results_score_idx ON public.eval_results(score);

-- =====================================================
-- VIEWS
-- =====================================================

-- Student registers view
CREATE VIEW public.student_registers AS
SELECT
    s.code as student_code,
    r.code as register_code,
    s.name,
    s.last_name,
    s.email,
    s.phone,
    r.roll_code,
    r.group_name,
    r.level_code,
    l.name as level,
    s.created_at
FROM
    public.registers r
    JOIN public.students s ON r.student_code = s.code
    JOIN public.levels l ON r.level_code = l.code;

-- Student register results view
CREATE OR REPLACE VIEW public.student_register_results AS
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
    public.eval_results er
    JOIN public.registers r ON er.register_code = r.code
    JOIN public.students s ON r.student_code = s.code
    JOIN public.levels l ON r.level_code = l.code
    JOIN public.evals e ON er.eval_code = e.code
WHERE
    er.section_code IS NULL; -- Only include general results (not section-specific)

-- =====================================================
-- COMPLEX FUNCTIONS
-- =====================================================

-- Function to get evaluation results with student information
CREATE OR REPLACE FUNCTION public.get_register_eval_results(p_eval_code TEXT)
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
        er.code::TEXT AS result_code,
        er.register_code::TEXT,
        er.eval_code::TEXT,
        er.section_code::TEXT,
        er.correct_count,
        er.incorrect_count,
        er.blank_count,
        er.score,
        er.calculated_at,
        r.student_code::TEXT,
        r.roll_code,
        r.group_name,
        r.level_code::TEXT,
        s.name,
        s.last_name,
        l.name AS level_name
    FROM
        public.eval_results er
        INNER JOIN public.registers r ON er.register_code = r.code
        INNER JOIN public.students s ON r.student_code = s.code
        INNER JOIN public.levels l ON r.level_code = l.code
    WHERE
        er.eval_code = p_eval_code::UUID
        AND er.section_code IS NULL -- Only include general results (not section-specific)
    ORDER BY
        er.score DESC;
$$;

-- Upsert eval results function
CREATE OR REPLACE FUNCTION public.upsert_eval_results(
    p_eval_code uuid,
    p_register_code uuid,
    p_answers jsonb, -- Array de objetos: { question_code: uuid, student_answer: text }
    p_general_result jsonb, -- Objeto: { correct_count, incorrect_count, blank_count, score }
    p_section_results jsonb -- Objeto: { section_code: { correct_count, incorrect_count, blank_count, score } }
)
RETURNS void AS $$
DECLARE
    v_answer record;
    v_section_code uuid;
    v_section_result jsonb;
    v_existing_result_code uuid;
BEGIN
    -- 1. Eliminar respuestas y resultados anteriores para esta evaluación y registro
    DELETE FROM public.eval_answers
    WHERE register_code = p_register_code
      AND question_code IN (SELECT code FROM public.eval_questions WHERE eval_code = p_eval_code);

    DELETE FROM public.eval_results
    WHERE register_code = p_register_code
      AND eval_code = p_eval_code;

    -- 2. Insertar nuevas respuestas
    FOR v_answer IN SELECT * FROM jsonb_to_recordset(p_answers) AS x(question_code uuid, student_answer text)
    LOOP
        INSERT INTO public.eval_answers (register_code, question_code, student_answer)
        VALUES (p_register_code, v_answer.question_code, v_answer.student_answer);
    END LOOP;

    -- 3. Insertar resultado general
    INSERT INTO public.eval_results (register_code, eval_code, section_code, correct_count, incorrect_count, blank_count, score)
    VALUES (
        p_register_code,
        p_eval_code,
        NULL, -- NULL section_code para resultado general
        (p_general_result->>'correct_count')::int,
        (p_general_result->>'incorrect_count')::int,
        (p_general_result->>'blank_count')::int,
        (p_general_result->>'score')::numeric
    );

    -- 4. Insertar resultados por sección
    FOR v_section_code, v_section_result IN SELECT * FROM jsonb_each(p_section_results)
    LOOP
        INSERT INTO public.eval_results (register_code, eval_code, section_code, correct_count, incorrect_count, blank_count, score)
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

-- Import student register function
CREATE OR REPLACE FUNCTION public.import_student_register(
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
  -- Validate group_name (constraint check)
  IF p_group_name NOT IN ('A', 'B', 'C', 'D') THEN
    RAISE EXCEPTION 'Invalid group_name: %. Must be one of A, B, C, D', p_group_name;
  END IF;

  -- Check if student already exists by email
  SELECT code INTO v_existing_student_code
  FROM public.students
  WHERE email = p_email AND user_code = p_user_code;

  IF v_existing_student_code IS NOT NULL THEN
    -- Student exists, use existing student_code
    v_student_code := v_existing_student_code;
  ELSE
    -- Create new student
    INSERT INTO public.students (name, last_name, phone, email, user_code)
    VALUES (p_name, p_last_name, p_phone, p_email, p_user_code)
    RETURNING code INTO v_student_code;
  END IF;

  -- Create register (this will fail if duplicate roll_code or student already registered in same level/group)
  INSERT INTO public.registers (student_code, level_code, group_name, roll_code, user_code)
  VALUES (v_student_code, p_level_code, p_group_name, p_roll_code, p_user_code);

EXCEPTION
  WHEN unique_violation THEN
    -- Get the constraint name to provide specific error message
    GET STACKED DIAGNOSTICS v_existing_student_code = CONSTRAINT_NAME;

    IF v_existing_student_code = 'uq_registers_roll_code' THEN
      RAISE EXCEPTION 'Roll code % already exists in this level', p_roll_code;
    ELSIF v_existing_student_code = 'uq_student_student_level_group' THEN
      RAISE EXCEPTION 'Student % is already registered in group % for this level', p_email, p_group_name;
    ELSE
      RAISE EXCEPTION 'Registration failed due to duplicate data: %', v_existing_student_code;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Student evaluation report function
CREATE OR REPLACE FUNCTION public.get_student_eval_report(p_student_code TEXT)
RETURNS TABLE (
    eval_name VARCHAR,
    eval_code TEXT,
    eval_date DATE,
    general_score NUMERIC,
    register_code TEXT,
    result_code TEXT,
    course_scores JSON
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_register_codes UUID[];
BEGIN
    -- Get all register codes for this student
    SELECT array_agg(code) INTO v_register_codes
    FROM public.registers
    WHERE student_code = p_student_code::UUID;

    -- Return empty set if no registers found
    IF v_register_codes IS NULL OR array_length(v_register_codes, 1) = 0 THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH general_results AS (
        -- Get general results (without section_code)
        SELECT
            e.name AS eval_name,
            e.code::TEXT AS eval_code,
            e.eval_date,
            er.score AS general_score,
            er.register_code::TEXT AS register_code,
            er.code::TEXT AS result_code
        FROM
            public.eval_results er
            JOIN public.evals e ON er.eval_code = e.code
        WHERE
            er.register_code = ANY(v_register_codes)
            AND er.section_code IS NULL
        ORDER BY
            e.eval_date DESC
    ),
    section_results AS (
        -- Get section-specific results
        SELECT
            er.register_code::TEXT AS register_code,
            er.eval_code::TEXT AS eval_code,
            er.section_code,
            er.score,
            c.name AS course_name
        FROM
            public.eval_results er
            JOIN public.eval_sections es ON er.section_code = es.code
            JOIN public.courses c ON es.course_code = c.code
        WHERE
            er.register_code = ANY(v_register_codes)
            AND er.section_code IS NOT NULL
    ),
    course_scores_json AS (
        -- Aggregate section results into JSON by eval
        SELECT
            sr.register_code,
            sr.eval_code,
            json_object_agg(
                sr.course_name,
                sr.score
            ) AS course_scores
        FROM
            section_results sr
        GROUP BY
            sr.register_code, sr.eval_code
    )
    -- Join everything together
    SELECT
        gr.eval_name,
        gr.eval_code,
        gr.eval_date,
        gr.general_score,
        gr.register_code,
        gr.result_code,
        COALESCE(csj.course_scores, '{}'::JSON) AS course_scores
    FROM
        general_results gr
        LEFT JOIN course_scores_json csj ON gr.register_code = csj.register_code AND gr.eval_code = csj.eval_code
    ORDER BY
        gr.eval_date DESC;
END;
$$;

-- =====================================================
-- DASHBOARD FUNCTIONS
-- =====================================================

-- Course dashboard functions
CREATE OR REPLACE FUNCTION public.get_level_course_scores(p_level_code TEXT, p_group_name TEXT)
RETURNS TABLE (
    course_code TEXT,
    course_name VARCHAR,
    average_score NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH course_results AS (
        -- Get section-specific results for the level and group
        SELECT
            es.course_code,
            c.name AS course_name,
            er.score
        FROM
            public.eval_results er
            JOIN public.eval_sections es ON er.section_code = es.code
            JOIN public.courses c ON es.course_code = c.code
            JOIN public.registers r ON er.register_code = r.code
        WHERE
            r.level_code = p_level_code::UUID
            AND r.group_name = p_group_name
            AND er.section_code IS NOT NULL
    ),
    course_averages AS (
        -- Calculate average score per course
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

-- Course evaluation scores function
CREATE OR REPLACE FUNCTION public.get_course_eval_scores(
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
        -- Get section-specific results for the level, course and group
        SELECT
            e.code AS eval_code,
            e.name AS eval_name,
            e.eval_date,
            er.score
        FROM
            public.eval_results er
            JOIN public.eval_sections es ON er.section_code = es.code
            JOIN public.evals e ON er.eval_code = e.code
            JOIN public.registers r ON er.register_code = r.code
        WHERE
            r.level_code = p_level_code::UUID
            AND r.group_name = p_group_name
            AND es.course_code = p_course_code::UUID
            AND er.section_code IS NOT NULL
    ),
    eval_averages AS (
        -- Calculate average score per evaluation
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

-- Student dashboard functions
CREATE OR REPLACE FUNCTION public.get_student_score_evolution(p_student_code TEXT)
RETURNS TABLE (
    eval_code TEXT,
    eval_name VARCHAR,
    eval_date DATE,
    score NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH student_results AS (
        -- Get all results for this student
        SELECT
            er.eval_code,
            e.name AS eval_name,
            e.eval_date,
            er.score
        FROM
            public.eval_results er
            JOIN public.registers r ON er.register_code = r.code
            JOIN public.evals e ON er.eval_code = e.code
        WHERE
            r.student_code = p_student_code::UUID
            AND er.section_code IS NULL -- Only include general results
        ORDER BY
            e.eval_date ASC
    )
    SELECT
        sr.eval_code::TEXT,
        sr.eval_name,
        sr.eval_date,
        sr.score
    FROM
        student_results sr;
END;
$$;

-- Student course scores function
CREATE OR REPLACE FUNCTION public.get_student_course_scores(p_student_code TEXT)
RETURNS TABLE (
    course_code TEXT,
    course_name VARCHAR,
    average_score NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH course_results AS (
        -- Get section-specific results for the student
        SELECT
            es.course_code,
            c.name AS course_name,
            er.score
        FROM
            public.eval_results er
            JOIN public.eval_sections es ON er.section_code = es.code
            JOIN public.courses c ON es.course_code = c.code
            JOIN public.registers r ON er.register_code = r.code
        WHERE
            r.student_code = p_student_code::UUID
            AND er.section_code IS NOT NULL
    ),
    course_averages AS (
        -- Calculate average score per course
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

-- Student course evolution function
CREATE OR REPLACE FUNCTION public.get_student_course_evolution(p_student_code TEXT)
RETURNS TABLE (
    eval_code TEXT,
    eval_name VARCHAR,
    eval_date DATE,
    course_code TEXT,
    course_name VARCHAR,
    score NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH course_evolution AS (
        -- Get section-specific results for the student over time
        SELECT
            e.code AS eval_code,
            e.name AS eval_name,
            e.eval_date,
            es.course_code,
            c.name AS course_name,
            er.score
        FROM
            public.eval_results er
            JOIN public.eval_sections es ON er.section_code = es.code
            JOIN public.courses c ON es.course_code = c.code
            JOIN public.evals e ON er.eval_code = e.code
            JOIN public.registers r ON er.register_code = r.code
        WHERE
            r.student_code = p_student_code::UUID
            AND er.section_code IS NOT NULL
        ORDER BY
            e.eval_date ASC, c.name ASC
    )
    SELECT
        ce.eval_code::TEXT,
        ce.eval_name,
        ce.eval_date,
        ce.course_code::TEXT,
        ce.course_name,
        ce.score
    FROM
        course_evolution ce;
END;
$$;

-- Level dashboard data function
CREATE OR REPLACE FUNCTION public.get_level_dashboard_data(p_level_code TEXT)
RETURNS TABLE (
    data_type TEXT,
    json_data JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_correct_vs_incorrect JSONB;
    v_scores_by_group JSONB;
BEGIN
    -- Get correct vs incorrect data
    SELECT
        jsonb_build_object(
            'correct', COALESCE(SUM(er.correct_count), 0),
            'incorrect', COALESCE(SUM(er.incorrect_count), 0),
            'blank', COALESCE(SUM(er.blank_count), 0)
        ) INTO v_correct_vs_incorrect
    FROM
        public.eval_results er
        JOIN public.registers r ON er.register_code = r.code
    WHERE
        r.level_code = p_level_code::UUID
        AND er.section_code IS NULL;

    -- Get scores by group data
    WITH group_scores AS (
        SELECT
            r.group_name,
            ROUND(AVG(er.score)::numeric, 2) AS average_score
        FROM
            public.eval_results er
            JOIN public.registers r ON er.register_code = r.code
        WHERE
            r.level_code = p_level_code::UUID
            AND er.section_code IS NULL
        GROUP BY
            r.group_name
        ORDER BY
            r.group_name
    )
    SELECT
        jsonb_agg(
            jsonb_build_object(
                'group', gs.group_name,
                'averageScore', gs.average_score
            )
            ORDER BY gs.group_name
        ) INTO v_scores_by_group
    FROM
        group_scores gs;

    -- Return the data
    RETURN QUERY
    SELECT 'correctVsIncorrect', v_correct_vs_incorrect
    UNION ALL
    SELECT 'scoresByGroup', COALESCE(v_scores_by_group, '[]'::jsonb);
END;
$$;

-- Group dashboard data function
CREATE OR REPLACE FUNCTION public.get_group_dashboard_data(p_level_code TEXT, p_group_name TEXT)
RETURNS TABLE (
    data_type TEXT,
    json_data JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_scores_by_eval JSONB;
    v_student_performance JSONB;
BEGIN
    -- Get scores by eval data
    WITH eval_scores AS (
        SELECT
            e.name,
            e.eval_date,
            ROUND(AVG(er.score)::numeric, 2) AS average_score
        FROM
            public.eval_results er
            JOIN public.registers r ON er.register_code = r.code
            JOIN public.evals e ON er.eval_code = e.code
        WHERE
            r.level_code = p_level_code::UUID
            AND r.group_name = p_group_name
            AND er.section_code IS NULL
        GROUP BY
            e.code, e.name, e.eval_date
    )
    SELECT
        jsonb_agg(
            jsonb_build_object(
                'name', es.name,
                'averageScore', es.average_score
            )
            ORDER BY es.eval_date ASC
        ) INTO v_scores_by_eval
    FROM
        eval_scores es;

    -- Get student performance data (top 10)
    WITH student_scores AS (
        SELECT
            s.name || ' ' || s.last_name AS student_name,
            ROUND(AVG(er.score)::numeric, 2) AS avg_score
        FROM
            public.eval_results er
            JOIN public.registers r ON er.register_code = r.code
            JOIN public.students s ON r.student_code = s.code
        WHERE
            r.level_code = p_level_code::UUID
            AND r.group_name = p_group_name
            AND er.section_code IS NULL
        GROUP BY
            s.code, s.name, s.last_name
        ORDER BY
            avg_score DESC
        LIMIT 10
    )
    SELECT
        jsonb_agg(
            jsonb_build_object(
                'name', ss.student_name,
                'averageScore', ss.avg_score
            )
            ORDER BY ss.avg_score DESC
        ) INTO v_student_performance
    FROM
        student_scores ss;

    -- Return the data
    RETURN QUERY
    SELECT 'scoresByEval', COALESCE(v_scores_by_eval, '[]'::jsonb)
    UNION ALL
    SELECT 'studentPerformance', COALESCE(v_student_performance, '[]'::jsonb);
END;
$$;

-- Evaluation dashboard data function
CREATE OR REPLACE FUNCTION public.get_eval_dashboard_data(p_eval_code TEXT)
RETURNS TABLE (
    data_type TEXT,
    json_data JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_top_correct_questions JSONB;
    v_top_incorrect_questions JSONB;
    v_score_distribution JSONB;
BEGIN
    -- Get top 5 most correctly answered questions
    WITH question_stats AS (
        SELECT
            eq.code AS question_code,
            eq.order_in_eval,
            es.course_code,
            c.name AS course_name,
            COUNT(CASE WHEN ea.student_answer = eq.correct_key THEN 1 END) AS correct_count,
            COUNT(ea.student_answer) AS total_answers,
            CASE
                WHEN COUNT(ea.student_answer) > 0 THEN
                    ROUND((COUNT(CASE WHEN ea.student_answer = eq.correct_key THEN 1 END)::NUMERIC / COUNT(ea.student_answer)) * 100, 2)
                ELSE 0
            END AS correct_percentage
        FROM
            public.eval_questions eq
            JOIN public.eval_sections es ON eq.section_code = es.code
            JOIN public.courses c ON es.course_code = c.code
            LEFT JOIN public.eval_answers ea ON eq.code = ea.question_code
        WHERE
            eq.eval_code = p_eval_code::UUID
        GROUP BY
            eq.code, eq.order_in_eval, es.course_code, c.name
        ORDER BY
            correct_percentage DESC, eq.order_in_eval
        LIMIT 5
    )
    SELECT
        jsonb_agg(
            jsonb_build_object(
                'questionCode', qs.question_code,
                'orderInEval', qs.order_in_eval,
                'courseName', qs.course_name,
                'correctCount', qs.correct_count,
                'totalAnswers', qs.total_answers,
                'correctPercentage', qs.correct_percentage
            )
            ORDER BY qs.correct_percentage DESC, qs.order_in_eval
        ) INTO v_top_correct_questions
    FROM
        question_stats qs;

    -- Get top 5 most incorrectly answered questions
    WITH question_stats AS (
        SELECT
            eq.code AS question_code,
            eq.order_in_eval,
            es.course_code,
            c.name AS course_name,
            COUNT(CASE WHEN ea.student_answer != eq.correct_key AND ea.student_answer IS NOT NULL THEN 1 END) AS incorrect_count,
            COUNT(ea.student_answer) AS total_answers,
            CASE
                WHEN COUNT(ea.student_answer) > 0 THEN
                    ROUND((COUNT(CASE WHEN ea.student_answer != eq.correct_key AND ea.student_answer IS NOT NULL THEN 1 END)::NUMERIC / COUNT(ea.student_answer)) * 100, 2)
                ELSE 0
            END AS incorrect_percentage
        FROM
            public.eval_questions eq
            JOIN public.eval_sections es ON eq.section_code = es.code
            JOIN public.courses c ON es.course_code = c.code
            LEFT JOIN public.eval_answers ea ON eq.code = ea.question_code
        WHERE
            eq.eval_code = p_eval_code::UUID
        GROUP BY
            eq.code, eq.order_in_eval, es.course_code, c.name
        ORDER BY
            incorrect_percentage DESC, eq.order_in_eval
        LIMIT 5
    )
    SELECT
        jsonb_agg(
            jsonb_build_object(
                'questionCode', qs.question_code,
                'orderInEval', qs.order_in_eval,
                'courseName', qs.course_name,
                'incorrectCount', qs.incorrect_count,
                'totalAnswers', qs.total_answers,
                'incorrectPercentage', qs.incorrect_percentage
            )
            ORDER BY qs.incorrect_percentage DESC, qs.order_in_eval
        ) INTO v_top_incorrect_questions
    FROM
        question_stats qs;

    -- Get score distribution (approved, between 10-14, below 10)
    WITH score_ranges AS (
        SELECT
            COUNT(CASE WHEN er.score >= 14 THEN 1 END) AS approved_count,
            COUNT(CASE WHEN er.score >= 10 AND er.score < 14 THEN 1 END) AS middle_count,
            COUNT(CASE WHEN er.score < 10 THEN 1 END) AS failed_count,
            COUNT(*) AS total_count
        FROM
            public.eval_results er
        WHERE
            er.eval_code = p_eval_code::UUID
            AND er.section_code IS NULL
    )
    SELECT
        jsonb_build_object(
            'approved', CASE
                WHEN sr.total_count > 0 THEN
                    ROUND((sr.approved_count::NUMERIC / sr.total_count) * 100, 2)
                ELSE 0
            END,
            'middle', CASE
                WHEN sr.total_count > 0 THEN
                    ROUND((sr.middle_count::NUMERIC / sr.total_count) * 100, 2)
                ELSE 0
            END,
            'failed', CASE
                WHEN sr.total_count > 0 THEN
                    ROUND((sr.failed_count::NUMERIC / sr.total_count) * 100, 2)
                ELSE 0
            END,
            'approvedCount', sr.approved_count,
            'middleCount', sr.middle_count,
            'failedCount', sr.failed_count,
            'totalCount', sr.total_count
        ) INTO v_score_distribution
    FROM
        score_ranges sr;

    -- Return the data
    RETURN QUERY
    SELECT 'topCorrectQuestions', COALESCE(v_top_correct_questions, '[]'::jsonb)
    UNION ALL
    SELECT 'topIncorrectQuestions', COALESCE(v_top_incorrect_questions, '[]'::jsonb)
    UNION ALL
    SELECT 'scoreDistribution', COALESCE(v_score_distribution, '{}'::jsonb);
END;
$$;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_results ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES (Simplified for clean architecture)
-- =====================================================

-- Users policies
CREATE POLICY "users_select_policy" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert_policy" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update_policy" ON public.users FOR UPDATE USING (true);
CREATE POLICY "users_delete_policy" ON public.users FOR DELETE USING (true);

-- Permissions policies
CREATE POLICY "permissions_select_policy" ON public.permissions FOR SELECT USING (public.has_permission('permissions', 'read'));
CREATE POLICY "permissions_insert_policy" ON public.permissions FOR INSERT WITH CHECK (public.has_permission('permissions', 'create'));
CREATE POLICY "permissions_update_policy" ON public.permissions FOR UPDATE USING (public.has_permission('permissions', 'update'));
CREATE POLICY "permissions_delete_policy" ON public.permissions FOR DELETE USING (public.has_permission('permissions', 'delete'));

-- Levels policies
CREATE POLICY "levels_select_policy" ON public.levels FOR SELECT USING (public.has_permission('levels', 'read'));
CREATE POLICY "levels_insert_policy" ON public.levels FOR INSERT WITH CHECK (public.has_permission('levels', 'create'));
CREATE POLICY "levels_update_policy" ON public.levels FOR UPDATE USING (public.has_permission('levels', 'update'));
CREATE POLICY "levels_delete_policy" ON public.levels FOR DELETE USING (public.has_permission('levels', 'delete'));

-- Courses policies
CREATE POLICY "courses_select_policy" ON public.courses FOR SELECT USING (public.has_permission('courses', 'read'));
CREATE POLICY "courses_insert_policy" ON public.courses FOR INSERT WITH CHECK (public.has_permission('courses', 'create'));
CREATE POLICY "courses_update_policy" ON public.courses FOR UPDATE USING (public.has_permission('courses', 'update'));
CREATE POLICY "courses_delete_policy" ON public.courses FOR DELETE USING (public.has_permission('courses', 'delete'));

-- Students policies
CREATE POLICY "students_select_policy" ON public.students FOR SELECT USING (public.has_permission('students', 'read'));
CREATE POLICY "students_insert_policy" ON public.students FOR INSERT WITH CHECK (public.has_permission('students', 'create'));
CREATE POLICY "students_update_policy" ON public.students FOR UPDATE USING (public.has_permission('students', 'update'));
CREATE POLICY "students_delete_policy" ON public.students FOR DELETE USING (public.has_permission('students', 'delete'));

-- Registers policies
CREATE POLICY "registers_select_policy" ON public.registers FOR SELECT USING (public.has_permission('registers', 'read'));
CREATE POLICY "registers_insert_policy" ON public.registers FOR INSERT WITH CHECK (public.has_permission('registers', 'create'));
CREATE POLICY "registers_update_policy" ON public.registers FOR UPDATE USING (public.has_permission('registers', 'update'));
CREATE POLICY "registers_delete_policy" ON public.registers FOR DELETE USING (public.has_permission('registers', 'delete'));

-- Evals policies
CREATE POLICY "evals_select_policy" ON public.evals FOR SELECT USING (public.has_permission('evals', 'read'));
CREATE POLICY "evals_insert_policy" ON public.evals FOR INSERT WITH CHECK (public.has_permission('evals', 'create'));
CREATE POLICY "evals_update_policy" ON public.evals FOR UPDATE USING (public.has_permission('evals', 'update'));
CREATE POLICY "evals_delete_policy" ON public.evals FOR DELETE USING (public.has_permission('evals', 'delete'));

-- Eval sections policies
CREATE POLICY "eval_sections_select_policy" ON public.eval_sections FOR SELECT USING (public.has_permission('eval_sections', 'read'));
CREATE POLICY "eval_sections_insert_policy" ON public.eval_sections FOR INSERT WITH CHECK (public.has_permission('eval_sections', 'create'));
CREATE POLICY "eval_sections_update_policy" ON public.eval_sections FOR UPDATE USING (public.has_permission('eval_sections', 'update'));
CREATE POLICY "eval_sections_delete_policy" ON public.eval_sections FOR DELETE USING (public.has_permission('eval_sections', 'delete'));

-- Eval questions policies
CREATE POLICY "eval_questions_select_policy" ON public.eval_questions FOR SELECT USING (public.has_permission('eval_questions', 'read'));
CREATE POLICY "eval_questions_insert_policy" ON public.eval_questions FOR INSERT WITH CHECK (public.has_permission('eval_questions', 'create'));
CREATE POLICY "eval_questions_update_policy" ON public.eval_questions FOR UPDATE USING (public.has_permission('eval_questions', 'update'));
CREATE POLICY "eval_questions_delete_policy" ON public.eval_questions FOR DELETE USING (public.has_permission('eval_questions', 'delete'));

-- Eval answers policies
CREATE POLICY "eval_answers_select_policy" ON public.eval_answers FOR SELECT USING (public.has_permission('eval_answers', 'read'));
CREATE POLICY "eval_answers_insert_policy" ON public.eval_answers FOR INSERT WITH CHECK (public.has_permission('eval_answers', 'create'));
CREATE POLICY "eval_answers_update_policy" ON public.eval_answers FOR UPDATE USING (public.has_permission('eval_answers', 'update'));
CREATE POLICY "eval_answers_delete_policy" ON public.eval_answers FOR DELETE USING (public.has_permission('eval_answers', 'delete'));

-- Eval results policies
CREATE POLICY "eval_results_select_policy" ON public.eval_results FOR SELECT USING (public.has_permission('eval_results', 'read'));
CREATE POLICY "eval_results_insert_policy" ON public.eval_results FOR INSERT WITH CHECK (public.has_permission('eval_results', 'create'));
CREATE POLICY "eval_results_update_policy" ON public.eval_results FOR UPDATE USING (public.has_permission('eval_results', 'update'));
CREATE POLICY "eval_results_delete_policy" ON public.eval_results FOR DELETE USING (public.has_permission('eval_results', 'delete'));

-- =====================================================
-- GRANTS AND PERMISSIONS
-- =====================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO postgres;

-- Grant permissions on all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.get_register_eval_results(TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.upsert_eval_results(uuid, uuid, jsonb, jsonb, jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT, TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.timestamp_updater() TO postgres;
GRANT EXECUTE ON FUNCTION public.import_student_register(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, UUID) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_student_eval_report(TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_level_course_scores(TEXT, TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_course_eval_scores(TEXT, TEXT, TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_student_score_evolution(TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_student_course_scores(TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_student_course_evolution(TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_level_dashboard_data(TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_group_dashboard_data(TEXT, TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_eval_dashboard_data(TEXT) TO postgres;

-- Grant select permissions on views
GRANT SELECT ON public.student_registers TO postgres;
GRANT SELECT ON public.student_register_results TO postgres;

-- =====================================================
-- INITIAL DATA (Optional)
-- =====================================================

-- Insert a default super admin user (password: 'admin123' - MUST CHANGE IN PRODUCTION!)
-- TODO: Replace this with a proper bcrypt hash before deploying to production
INSERT INTO public.users (email, password_hash, is_super_admin, is_email_verified, name, last_name)
VALUES (
    'admin@nextya.com',
    '$2b$10$PLACEHOLDER_HASH_CHANGE_IN_PRODUCTION_PLACEHOLDER_HASH', -- PLACEHOLDER - Generate real bcrypt hash for 'admin123' or your chosen password
    true,
    true,
    'Super',
    'Admin'
);

-- =====================================================
-- SCHEMA COMPLETE
-- =====================================================