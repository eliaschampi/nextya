-- =====================================================
-- NextYa Database Constraints and Indexes
-- =====================================================
-- Additional constraints, indexes, and triggers
-- =====================================================

-- =====================================================
-- INDEXES
-- =====================================================

-- Users table indexes
CREATE INDEX users_email_idx ON public.users (email);

-- Permissions table indexes
CREATE INDEX permissions_user_code_idx ON public.permissions (user_code);
CREATE INDEX permissions_entity_idx ON public.permissions (entity);

-- Students table indexes
CREATE INDEX students_user_code_idx ON public.students (user_code);
CREATE INDEX students_name_search_idx ON public.students USING GIN (TO_TSVECTOR('english', name || ' ' || last_name));

-- Levels table indexes
CREATE INDEX levels_name_idx ON public.levels (name);

-- Courses table indexes
CREATE INDEX courses_user_code_idx ON public.courses (user_code);

-- Registers table indexes
CREATE INDEX registers_student_code_idx ON public.registers (student_code);
CREATE INDEX registers_level_code_idx ON public.registers (level_code);
CREATE INDEX registers_user_code_idx ON public.registers (user_code);
CREATE INDEX registers_group_level_idx ON public.registers (group_name, level_code);

-- Evals table indexes
CREATE INDEX evals_level_code_idx ON public.evals (level_code);
CREATE INDEX evals_user_code_idx ON public.evals (user_code);
CREATE INDEX evals_group_date_idx ON public.evals (group_name, eval_date);

-- Eval sections table indexes
CREATE INDEX eval_sections_eval_code_idx ON public.eval_sections (eval_code);
CREATE INDEX eval_sections_course_code_idx ON public.eval_sections (course_code);
CREATE INDEX eval_sections_order_idx ON public.eval_sections (order_in_eval);

-- Eval questions table indexes
CREATE INDEX eval_questions_eval_code_idx ON public.eval_questions (eval_code);
CREATE INDEX eval_questions_section_code_idx ON public.eval_questions (section_code);
CREATE INDEX eval_questions_order_idx ON public.eval_questions (order_in_eval);

-- Eval answers table indexes
CREATE INDEX eval_answers_register_code_idx ON public.eval_answers (register_code);
CREATE INDEX eval_answers_question_code_idx ON public.eval_answers (question_code);
CREATE INDEX eval_answers_student_answer_idx ON public.eval_answers (student_answer)
WHERE student_answer IS NOT NULL;

-- Eval results table indexes
CREATE INDEX eval_results_register_code_idx ON public.eval_results (register_code);
CREATE INDEX eval_results_eval_code_idx ON public.eval_results (eval_code);
CREATE INDEX eval_results_section_code_idx ON public.eval_results (section_code)
WHERE section_code IS NOT NULL;
CREATE INDEX eval_results_score_idx ON public.eval_results (score);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Timestamp updater function
CREATE OR REPLACE FUNCTION public.timestamp_updater () RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users table trigger
CREATE TRIGGER users_updated_at_tg BEFORE UPDATE ON public.users 
FOR EACH ROW EXECUTE FUNCTION public.timestamp_updater ();

-- Students table trigger
CREATE TRIGGER students_updated_at_tg BEFORE UPDATE ON public.students 
FOR EACH ROW EXECUTE FUNCTION public.timestamp_updater ();

-- Evals table trigger
CREATE TRIGGER evals_updated_at_tg BEFORE UPDATE ON public.evals 
FOR EACH ROW EXECUTE FUNCTION public.timestamp_updater ();
