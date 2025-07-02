-- =====================================================
-- NEXTYA DATABASE SCHEMA - VIEWS
-- =====================================================
-- Convenient views for common queries and reporting

-- =====================================================
-- USER & STUDENT VIEWS
-- =====================================================

-- Complete student information with user details
CREATE OR REPLACE VIEW v_students_complete AS
SELECT 
    s.code,
    s.name,
    s.last_name,
    s.email,
    s.created_at,
    u.name AS teacher_name,
    u.last_name AS teacher_last_name,
    u.email AS teacher_email,
    s.name || ' ' || s.last_name AS full_name
FROM students s
JOIN users u ON s.user_code = u.code;

-- User permissions summary
CREATE OR REPLACE VIEW v_user_permissions AS
SELECT 
    u.code AS user_code,
    u.email,
    u.name,
    u.last_name,
    u.is_super_admin,
    COUNT(p.code) AS total_permissions,
    array_agg(DISTINCT p.permission_type) AS permission_types
FROM users u
LEFT JOIN permissions p ON u.code = p.user_code
GROUP BY u.code, u.email, u.name, u.last_name, u.is_super_admin;

-- =====================================================
-- EVALUATION VIEWS
-- =====================================================

-- Complete evaluation information
CREATE OR REPLACE VIEW v_evaluations_complete AS
SELECT 
    e.code,
    e.name,
    e.eval_date,
    e.total_questions,
    e.created_at,
    l.name AS level_name,
    l.abr AS level_abr,
    u.name AS teacher_name,
    u.last_name AS teacher_last_name,
    COUNT(DISTINCT es.code) AS total_sections,
    COUNT(DISTINCT er.code) AS total_results
FROM evals e
JOIN levels l ON e.level_code = l.code
JOIN users u ON e.user_code = u.code
LEFT JOIN eval_sections es ON e.code = es.eval_code
LEFT JOIN eval_results er ON e.code = er.eval_code AND er.section_code IS NULL
GROUP BY e.code, e.name, e.eval_date, e.total_questions, e.created_at, 
         l.name, l.abr, u.name, u.last_name;

-- Evaluation sections with course details
CREATE OR REPLACE VIEW v_eval_sections_complete AS
SELECT 
    es.code,
    es.name AS section_name,
    es.total_questions,
    es.start_question,
    e.name AS eval_name,
    e.eval_date,
    c.name AS course_name,
    c.abr AS course_abr,
    l.name AS level_name
FROM eval_sections es
JOIN evals e ON es.eval_code = e.code
JOIN courses c ON es.course_code = c.code
JOIN levels l ON e.level_code = l.code;

-- =====================================================
-- STUDENT PERFORMANCE VIEWS
-- =====================================================

-- Student registration details
CREATE OR REPLACE VIEW v_student_registrations AS
SELECT 
    r.code AS register_code,
    r.group_name,
    r.roll_code,
    r.created_at AS registration_date,
    s.name AS student_name,
    s.last_name AS student_last_name,
    s.email AS student_email,
    l.name AS level_name,
    l.abr AS level_abr,
    u.name AS teacher_name
FROM registers r
JOIN students s ON r.student_code = s.code
JOIN levels l ON r.level_code = l.code
JOIN users u ON r.user_code = u.code;

-- Student evaluation results summary
CREATE OR REPLACE VIEW v_student_results_summary AS
SELECT 
    r.student_code,
    s.name AS student_name,
    s.last_name AS student_last_name,
    e.code AS eval_code,
    e.name AS eval_name,
    e.eval_date,
    er.score,
    er.correct_count,
    er.incorrect_count,
    er.blank_count,
    l.name AS level_name,
    r.group_name,
    CASE 
        WHEN er.score >= 14 THEN 'Aprobado'
        WHEN er.score >= 10 THEN 'Regular'
        ELSE 'Reprobado'
    END AS status
FROM eval_results er
JOIN registers r ON er.register_code = r.code
JOIN students s ON r.student_code = s.code
JOIN evals e ON er.eval_code = e.code
JOIN levels l ON e.level_code = l.code
WHERE er.section_code IS NULL;

-- =====================================================
-- ANALYTICS VIEWS
-- =====================================================

-- Question difficulty analysis
CREATE OR REPLACE VIEW v_question_difficulty AS
SELECT 
    eq.code AS question_code,
    eq.order_in_eval,
    eq.correct_key,
    e.name AS eval_name,
    c.name AS course_name,
    COUNT(ea.code) AS total_answers,
    COUNT(CASE WHEN ea.is_correct = true THEN 1 END) AS correct_answers,
    COUNT(CASE WHEN ea.is_correct = false THEN 1 END) AS incorrect_answers,
    COUNT(CASE WHEN ea.student_answer IS NULL THEN 1 END) AS blank_answers,
    CASE 
        WHEN COUNT(ea.code) > 0 THEN 
            ROUND((COUNT(CASE WHEN ea.is_correct = true THEN 1 END)::NUMERIC / COUNT(ea.code)) * 100, 2)
        ELSE 0 
    END AS correct_percentage,
    CASE 
        WHEN COUNT(ea.code) > 0 THEN 
            ROUND((COUNT(CASE WHEN ea.student_answer IS NULL THEN 1 END)::NUMERIC / COUNT(ea.code)) * 100, 2)
        ELSE 0 
    END AS blank_percentage
FROM eval_questions eq
JOIN evals e ON eq.eval_code = e.code
LEFT JOIN eval_sections es ON eq.section_code = es.code
LEFT JOIN courses c ON es.course_code = c.code
LEFT JOIN eval_answers ea ON eq.code = ea.question_code
GROUP BY eq.code, eq.order_in_eval, eq.correct_key, e.name, c.name;

-- Course performance summary
CREATE OR REPLACE VIEW v_course_performance AS
SELECT 
    c.code AS course_code,
    c.name AS course_name,
    c.abr AS course_abr,
    l.name AS level_name,
    COUNT(DISTINCT er.code) AS total_results,
    ROUND(AVG(er.score), 2) AS avg_score,
    MAX(er.score) AS max_score,
    MIN(er.score) AS min_score,
    COUNT(CASE WHEN er.score >= 14 THEN 1 END) AS approved_count,
    COUNT(CASE WHEN er.score < 10 THEN 1 END) AS failed_count,
    CASE 
        WHEN COUNT(er.code) > 0 THEN 
            ROUND((COUNT(CASE WHEN er.score >= 14 THEN 1 END)::NUMERIC / COUNT(er.code)) * 100, 2)
        ELSE 0 
    END AS approval_rate
FROM courses c
JOIN eval_sections es ON c.code = es.course_code
JOIN evals e ON es.eval_code = e.code
JOIN levels l ON e.level_code = l.code
LEFT JOIN eval_results er ON es.code = er.section_code
GROUP BY c.code, c.name, c.abr, l.name;

-- =====================================================
-- DASHBOARD VIEWS
-- =====================================================

-- Recent evaluations dashboard
CREATE OR REPLACE VIEW v_recent_evaluations AS
SELECT 
    e.code,
    e.name,
    e.eval_date,
    e.total_questions,
    l.name AS level_name,
    u.name AS teacher_name,
    COUNT(DISTINCT er.code) AS total_participants,
    ROUND(AVG(er.score), 2) AS avg_score,
    COUNT(CASE WHEN er.score >= 14 THEN 1 END) AS approved_count
FROM evals e
JOIN levels l ON e.level_code = l.code
JOIN users u ON e.user_code = u.code
LEFT JOIN eval_results er ON e.code = er.eval_code AND er.section_code IS NULL
WHERE e.eval_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY e.code, e.name, e.eval_date, e.total_questions, l.name, u.name
ORDER BY e.eval_date DESC;

-- Teacher statistics
CREATE OR REPLACE VIEW v_teacher_statistics AS
SELECT 
    u.code AS teacher_code,
    u.name,
    u.last_name,
    u.email,
    COUNT(DISTINCT s.code) AS total_students,
    COUNT(DISTINCT l.code) AS total_levels,
    COUNT(DISTINCT c.code) AS total_courses,
    COUNT(DISTINCT e.code) AS total_evaluations,
    COUNT(DISTINCT er.code) AS total_results
FROM users u
LEFT JOIN students s ON u.code = s.user_code
LEFT JOIN levels l ON u.code = l.user_code
LEFT JOIN courses c ON u.code = c.user_code
LEFT JOIN evals e ON u.code = e.user_code
LEFT JOIN eval_results er ON e.code = er.eval_code AND er.section_code IS NULL
GROUP BY u.code, u.name, u.last_name, u.email;
