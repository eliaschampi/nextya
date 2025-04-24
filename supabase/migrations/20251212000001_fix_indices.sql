

-- 1. Permissions table
CREATE INDEX idx_permissions_user_code ON public.permissions(user_code);
CREATE INDEX idx_permissions_entity ON public.permissions(entity);

-- 2. Students table
CREATE INDEX idx_students_user_code ON public.students(user_code);
CREATE INDEX idx_students_name_search ON public.students USING GIN (to_tsvector('english', name || ' ' || last_name));

-- 3. Levels table
CREATE INDEX idx_levels_name ON public.levels(name);

-- 4. Courses table
CREATE INDEX idx_courses_user_code ON public.courses(user_code);

-- 5. Registers table
CREATE INDEX idx_registers_student_code ON public.registers(student_code);
CREATE INDEX idx_registers_level_code ON public.registers(level_code);
CREATE INDEX idx_registers_user_code ON public.registers(user_code);
CREATE INDEX idx_registers_group_level ON public.registers(group_name, level_code);

-- 6. Evals table
CREATE INDEX idx_evals_level_code ON public.evals(level_code);
CREATE INDEX idx_evals_user_code ON public.evals(user_code);
CREATE INDEX idx_evals_group_date ON public.evals(group_name, eval_date);

-- 7. Eval sections table
CREATE INDEX idx_eval_sections_eval_code ON public.eval_sections(eval_code);
CREATE INDEX idx_eval_sections_course_code ON public.eval_sections(course_code);
CREATE INDEX idx_eval_sections_order ON public.eval_sections(order_in_eval);

-- 8. Eval questions table
CREATE INDEX idx_eval_questions_eval_code ON public.eval_questions(eval_code);
CREATE INDEX idx_eval_questions_section_code ON public.eval_questions(section_code);
CREATE INDEX idx_eval_questions_order ON public.eval_questions(order_in_eval);

-- 9. Eval answers table
CREATE INDEX idx_eval_answers_register_code ON public.eval_answers(register_code);
CREATE INDEX idx_eval_answers_question_code ON public.eval_answers(question_code);
CREATE INDEX idx_eval_answers_student_answer ON public.eval_answers(student_answer) WHERE student_answer IS NOT NULL;

-- 10. Eval results table
CREATE INDEX idx_eval_results_register_code ON public.eval_results(register_code);
CREATE INDEX idx_eval_results_eval_code ON public.eval_results(eval_code);
CREATE INDEX idx_eval_results_section_code ON public.eval_results(section_code) WHERE section_code IS NOT NULL;
CREATE INDEX idx_eval_results_score ON public.eval_results(score);
