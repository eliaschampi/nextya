-- =====================================================
-- NextYa Database Tables
-- =====================================================
-- All table definitions
-- =====================================================

-- Users table (clean implementation without Supabase auth)
CREATE TABLE public.users (
  code UUID NOT NULL DEFAULT gen_random_uuid (),
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
  code UUID NOT NULL DEFAULT gen_random_uuid (),
  user_code UUID NOT NULL,
  entity TEXT NOT NULL,
  action VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT permissions_pk PRIMARY KEY (code),
  CONSTRAINT permissions_user_fk FOREIGN KEY (user_code) REFERENCES public.users (code) ON DELETE CASCADE,
  CONSTRAINT permissions_entity_user_action_uq UNIQUE (entity, user_code, action)
);

-- Levels table
CREATE TABLE public.levels (
  code UUID NOT NULL DEFAULT gen_random_uuid (),
  name VARCHAR(100) NOT NULL,
  abr TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  users UUID[] NOT NULL,
  CONSTRAINT levels_pk PRIMARY KEY (code)
);

-- Courses
CREATE TABLE public.courses (
  code UUID NOT NULL DEFAULT gen_random_uuid (),
  name VARCHAR(100) NOT NULL,
  user_code UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT courses_pk PRIMARY KEY (code),
  CONSTRAINT courses_user_fk FOREIGN KEY (user_code) REFERENCES public.users (code) ON DELETE CASCADE
);

-- Students table
CREATE TABLE public.students (
  code UUID NOT NULL DEFAULT gen_random_uuid (),
  name VARCHAR(100) NOT NULL,
  last_name VARCHAR(150) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(100) NULL,
  user_code UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT students_pk PRIMARY KEY (code),
  CONSTRAINT students_user_fk FOREIGN KEY (user_code) REFERENCES public.users (code) ON DELETE CASCADE,
  CONSTRAINT students_name_lastname_uq UNIQUE (name, last_name)
);

-- Registers table
CREATE TABLE public.registers (
  code UUID NOT NULL DEFAULT gen_random_uuid (),
  student_code UUID NOT NULL,
  level_code UUID NOT NULL,
  group_name CHAR(1) NOT NULL,
  user_code UUID NOT NULL,
  roll_code CHAR(4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT registers_pk PRIMARY KEY (code),
  CONSTRAINT registers_student_fk FOREIGN KEY (student_code) REFERENCES public.students (code) ON DELETE CASCADE,
  CONSTRAINT registers_level_fk FOREIGN KEY (level_code) REFERENCES public.levels (code) ON DELETE CASCADE,
  CONSTRAINT registers_user_fk FOREIGN KEY (user_code) REFERENCES public.users (code) ON DELETE CASCADE,
  CONSTRAINT registers_student_level_group_uq UNIQUE (student_code, level_code, group_name),
  CONSTRAINT registers_roll_code_uq UNIQUE (level_code, roll_code),
  CONSTRAINT registers_group_ck CHECK (group_name IN ('A', 'B', 'C', 'D'))
);

-- Evals table
CREATE TABLE public.evals (
  code UUID NOT NULL DEFAULT gen_random_uuid (),
  name VARCHAR NOT NULL,
  level_code UUID NOT NULL,
  group_name CHAR(1) NOT NULL,
  eval_date DATE NOT NULL,
  user_code UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT evals_pk PRIMARY KEY (code),
  CONSTRAINT evals_level_fk FOREIGN KEY (level_code) REFERENCES public.levels (code),
  CONSTRAINT evals_user_fk FOREIGN KEY (user_code) REFERENCES public.users (code),
  CONSTRAINT evals_group_ck CHECK (group_name IN ('A', 'B', 'C', 'D'))
);

-- Eval sections table
CREATE TABLE public.eval_sections (
  code UUID NOT NULL DEFAULT gen_random_uuid (),
  eval_code UUID NOT NULL,
  course_code UUID NOT NULL,
  order_in_eval INT NOT NULL,
  question_count INT NOT NULL,
  CONSTRAINT eval_sections_pk PRIMARY KEY (code),
  CONSTRAINT eval_sections_eval_fk FOREIGN KEY (eval_code) REFERENCES public.evals (code) ON DELETE CASCADE,
  CONSTRAINT eval_sections_course_fk FOREIGN KEY (course_code) REFERENCES public.courses (code),
  CONSTRAINT eval_sections_eval_course_uq UNIQUE (eval_code, course_code),
  CONSTRAINT eval_sections_eval_order_uq UNIQUE (eval_code, order_in_eval)
);

-- Eval questions table
CREATE TABLE public.eval_questions (
  code UUID NOT NULL DEFAULT gen_random_uuid (),
  eval_code UUID NOT NULL,
  section_code UUID NOT NULL,
  order_in_eval INT NOT NULL,
  correct_key CHAR(1) NOT NULL,
  omitable BOOLEAN DEFAULT FALSE,
  score_percent NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
  CONSTRAINT eval_questions_pk PRIMARY KEY (code),
  CONSTRAINT eval_questions_eval_fk FOREIGN KEY (eval_code) REFERENCES public.evals (code) ON DELETE CASCADE,
  CONSTRAINT eval_questions_section_fk FOREIGN KEY (section_code) REFERENCES public.eval_sections (code) ON DELETE CASCADE,
  CONSTRAINT eval_questions_order_uq UNIQUE (eval_code, order_in_eval),
  CONSTRAINT eval_questions_correct_key_ck CHECK (correct_key IN ('A', 'B', 'C', 'D', 'E')),
  CONSTRAINT eval_questions_score_ck CHECK (score_percent BETWEEN 0 AND 1)
);

-- Eval answers table
CREATE TABLE public.eval_answers (
  code UUID NOT NULL DEFAULT gen_random_uuid (),
  register_code UUID NOT NULL,
  question_code UUID NOT NULL,
  student_answer TEXT NULL,
  CONSTRAINT eval_answers_pk PRIMARY KEY (code),
  CONSTRAINT eval_answers_register_fk FOREIGN KEY (register_code) REFERENCES public.registers (code) ON DELETE CASCADE,
  CONSTRAINT eval_answers_question_fk FOREIGN KEY (question_code) REFERENCES public.eval_questions (code) ON DELETE CASCADE,
  CONSTRAINT eval_answers_unique_uq UNIQUE (register_code, question_code),
  CONSTRAINT eval_answers_answer_ck CHECK (
    student_answer IN ('A', 'B', 'C', 'D', 'E', 'error_multiple')
    OR student_answer IS NULL
  )
);

-- Eval results table
CREATE TABLE public.eval_results (
  code UUID NOT NULL DEFAULT gen_random_uuid (),
  register_code UUID NOT NULL,
  eval_code UUID NOT NULL,
  section_code UUID NULL,
  correct_count INT NOT NULL DEFAULT 0,
  blank_count INT NOT NULL DEFAULT 0,
  incorrect_count INT NOT NULL DEFAULT 0,
  score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT eval_results_pk PRIMARY KEY (code),
  CONSTRAINT eval_results_register_fk FOREIGN KEY (register_code) REFERENCES public.registers (code) ON DELETE CASCADE,
  CONSTRAINT eval_results_eval_fk FOREIGN KEY (eval_code) REFERENCES public.evals (code) ON DELETE CASCADE,
  CONSTRAINT eval_results_section_fk FOREIGN KEY (section_code) REFERENCES public.eval_sections (code) ON DELETE CASCADE,
  CONSTRAINT eval_results_unique_uq UNIQUE (register_code, eval_code, section_code)
);
