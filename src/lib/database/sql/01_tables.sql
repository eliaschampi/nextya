-- =====================================================
-- NEXTYA DATABASE SCHEMA - TABLES
-- =====================================================
-- Clean, organized table definitions for the Nextya evaluation system
-- Migration from Supabase to PostgreSQL with Kysely

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Users table (replacing auth.users)
CREATE TABLE IF NOT EXISTS users (
    code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name VARCHAR(100),
    last_name VARCHAR(150),
    photo_url TEXT,
    last_login TIMESTAMPTZ,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_code UUID NOT NULL REFERENCES users(code) ON DELETE CASCADE,
    entity VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_code, entity, action)
);

-- Levels table
CREATE TABLE IF NOT EXISTS levels (
    code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    user_code UUID NOT NULL REFERENCES users(code) ON DELETE CASCADE,
    abr TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
    code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    user_code UUID NOT NULL REFERENCES users(code) ON DELETE CASCADE,
    abr TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    user_code UUID NOT NULL REFERENCES users(code) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- REGISTRATION & EVALUATION TABLES
-- =====================================================

-- Registers table (student-level assignments)
CREATE TABLE IF NOT EXISTS registers (
    code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_code UUID NOT NULL REFERENCES students(code) ON DELETE CASCADE,
    level_code UUID NOT NULL REFERENCES levels(code) ON DELETE CASCADE,
    group_name CHAR(1) NOT NULL,
    user_code UUID NOT NULL REFERENCES users(code) ON DELETE CASCADE,
    roll_code CHAR(4) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Evaluations table
CREATE TABLE IF NOT EXISTS evals (
    code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    level_code UUID NOT NULL REFERENCES levels(code) ON DELETE CASCADE,
    user_code UUID NOT NULL REFERENCES users(code) ON DELETE CASCADE,
    eval_date DATE NOT NULL,
    total_questions INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Evaluation sections (course-specific parts of evaluations)
CREATE TABLE IF NOT EXISTS eval_sections (
    code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eval_code UUID NOT NULL REFERENCES evals(code) ON DELETE CASCADE,
    course_code UUID NOT NULL REFERENCES courses(code) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    total_questions INTEGER NOT NULL DEFAULT 0,
    start_question INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- QUESTION & ANSWER TABLES
-- =====================================================

-- Evaluation questions
CREATE TABLE IF NOT EXISTS eval_questions (
    code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eval_code UUID NOT NULL REFERENCES evals(code) ON DELETE CASCADE,
    section_code UUID REFERENCES eval_sections(code) ON DELETE CASCADE,
    order_in_eval INTEGER NOT NULL,
    correct_key CHAR(1) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Student answers
CREATE TABLE IF NOT EXISTS eval_answers (
    code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_code UUID NOT NULL REFERENCES eval_questions(code) ON DELETE CASCADE,
    register_code UUID NOT NULL REFERENCES registers(code) ON DELETE CASCADE,
    student_answer CHAR(1),
    is_correct BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- RESULTS TABLES
-- =====================================================

-- Evaluation results (both general and section-specific)
CREATE TABLE IF NOT EXISTS eval_results (
    code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    eval_code UUID NOT NULL REFERENCES evals(code) ON DELETE CASCADE,
    register_code UUID NOT NULL REFERENCES registers(code) ON DELETE CASCADE,
    section_code UUID REFERENCES eval_sections(code) ON DELETE CASCADE,
    score NUMERIC(5,2) NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    incorrect_count INTEGER NOT NULL DEFAULT 0,
    blank_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
