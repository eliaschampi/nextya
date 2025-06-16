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