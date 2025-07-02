-- =====================================================
-- NEXTYA DATABASE SCHEMA - INDEXES
-- =====================================================
-- Performance optimization indexes for the Nextya evaluation system

-- =====================================================
-- PRIMARY KEY INDEXES (automatically created)
-- =====================================================
-- These are automatically created with PRIMARY KEY constraints:
-- - users(code)
-- - permissions(code)
-- - levels(code)
-- - courses(code)
-- - students(code)
-- - registers(code)
-- - evals(code)
-- - eval_sections(code)
-- - eval_questions(code)
-- - eval_answers(code)
-- - eval_results(code)

-- =====================================================
-- UNIQUE INDEXES
-- =====================================================

-- Unique email for users
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Unique combination for registers (student-level-group)
CREATE UNIQUE INDEX IF NOT EXISTS idx_registers_unique 
ON registers(student_code, level_code, group_name);

-- =====================================================
-- FOREIGN KEY PERFORMANCE INDEXES
-- =====================================================

-- Users relationships
CREATE INDEX IF NOT EXISTS idx_permissions_user_code ON permissions(user_code);
CREATE INDEX IF NOT EXISTS idx_permissions_granted_by ON permissions(granted_by);
CREATE INDEX IF NOT EXISTS idx_levels_user_code ON levels(user_code);
CREATE INDEX IF NOT EXISTS idx_courses_user_code ON courses(user_code);
CREATE INDEX IF NOT EXISTS idx_students_user_code ON students(user_code);

-- Registration relationships
CREATE INDEX IF NOT EXISTS idx_registers_student_code ON registers(student_code);
CREATE INDEX IF NOT EXISTS idx_registers_level_code ON registers(level_code);
CREATE INDEX IF NOT EXISTS idx_registers_user_code ON registers(user_code);

-- Evaluation relationships
CREATE INDEX IF NOT EXISTS idx_evals_level_code ON evals(level_code);
CREATE INDEX IF NOT EXISTS idx_evals_user_code ON evals(user_code);
CREATE INDEX IF NOT EXISTS idx_eval_sections_eval_code ON eval_sections(eval_code);
CREATE INDEX IF NOT EXISTS idx_eval_sections_course_code ON eval_sections(course_code);

-- Question and answer relationships
CREATE INDEX IF NOT EXISTS idx_eval_questions_eval_code ON eval_questions(eval_code);
CREATE INDEX IF NOT EXISTS idx_eval_questions_section_code ON eval_questions(section_code);
CREATE INDEX IF NOT EXISTS idx_eval_answers_question_code ON eval_answers(question_code);
CREATE INDEX IF NOT EXISTS idx_eval_answers_register_code ON eval_answers(register_code);

-- Results relationships
CREATE INDEX IF NOT EXISTS idx_eval_results_eval_code ON eval_results(eval_code);
CREATE INDEX IF NOT EXISTS idx_eval_results_register_code ON eval_results(register_code);
CREATE INDEX IF NOT EXISTS idx_eval_results_section_code ON eval_results(section_code);

-- =====================================================
-- QUERY PERFORMANCE INDEXES
-- =====================================================

-- Email lookup for authentication
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));

-- Student search indexes
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
CREATE INDEX IF NOT EXISTS idx_students_last_name ON students(last_name);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_full_name ON students(name, last_name);

-- Evaluation date queries
CREATE INDEX IF NOT EXISTS idx_evals_eval_date ON evals(eval_date);
CREATE INDEX IF NOT EXISTS idx_evals_date_level ON evals(eval_date, level_code);

-- Question ordering
CREATE INDEX IF NOT EXISTS idx_eval_questions_order ON eval_questions(eval_code, order_in_eval);
CREATE INDEX IF NOT EXISTS idx_eval_questions_section_order ON eval_questions(section_code, order_in_eval);

-- Score analysis indexes
CREATE INDEX IF NOT EXISTS idx_eval_results_score ON eval_results(score);
CREATE INDEX IF NOT EXISTS idx_eval_results_eval_score ON eval_results(eval_code, score);

-- Dashboard query optimization
CREATE INDEX IF NOT EXISTS idx_eval_results_general ON eval_results(eval_code) 
WHERE section_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_eval_results_sections ON eval_results(eval_code, section_code) 
WHERE section_code IS NOT NULL;

-- =====================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- =====================================================

-- Student evaluation history
CREATE INDEX IF NOT EXISTS idx_student_eval_history 
ON eval_results(register_code, eval_code, section_code);

-- Course performance analysis
CREATE INDEX IF NOT EXISTS idx_course_performance 
ON eval_results(section_code, score, correct_count);

-- Question analysis for dashboard
CREATE INDEX IF NOT EXISTS idx_question_analysis 
ON eval_answers(question_code, student_answer, is_correct);

-- Permission lookups
CREATE INDEX IF NOT EXISTS idx_permissions_lookup 
ON permissions(user_code, permission_type, resource_type);

-- =====================================================
-- TEXT SEARCH INDEXES
-- =====================================================

-- Full-text search for students (if needed in the future)
-- CREATE INDEX IF NOT EXISTS idx_students_fulltext 
-- ON students USING gin(to_tsvector('spanish', name || ' ' || last_name || ' ' || COALESCE(email, '')));

-- =====================================================
-- PARTIAL INDEXES FOR SPECIFIC CONDITIONS
-- =====================================================

-- Active users only
CREATE INDEX IF NOT EXISTS idx_users_active 
ON users(code, email) WHERE is_email_verified = true;

-- Super admin users
CREATE INDEX IF NOT EXISTS idx_users_super_admin 
ON users(code) WHERE is_super_admin = true;

-- Recent evaluations (last 6 months)
CREATE INDEX IF NOT EXISTS idx_evals_recent 
ON evals(eval_date, level_code) 
WHERE eval_date >= CURRENT_DATE - INTERVAL '6 months';

-- Correct answers only
CREATE INDEX IF NOT EXISTS idx_eval_answers_correct 
ON eval_answers(question_code, register_code) 
WHERE is_correct = true;

-- =====================================================
-- ORDERING INDEXES
-- =====================================================

-- Level ordering
CREATE INDEX IF NOT EXISTS idx_levels_order ON levels("order", name);

-- Course ordering  
CREATE INDEX IF NOT EXISTS idx_courses_order ON courses("order", name);

-- Created at timestamps for pagination
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_students_created_at ON students(created_at);
CREATE INDEX IF NOT EXISTS idx_evals_created_at ON evals(created_at);
CREATE INDEX IF NOT EXISTS idx_eval_results_created_at ON eval_results(created_at);
