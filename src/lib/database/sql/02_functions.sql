-- =====================================================
-- NEXTYA DATABASE SCHEMA - FUNCTIONS
-- =====================================================
-- Database functions for dashboard analytics and reporting

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STUDENT DASHBOARD FUNCTIONS
-- =====================================================

-- Get student score evolution over time
CREATE OR REPLACE FUNCTION get_student_score_evolution(p_student_code TEXT)
RETURNS TABLE (
    eval_code TEXT,
    eval_name VARCHAR,
    eval_date DATE,
    score NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH student_results AS (
        SELECT
            er.eval_code,
            e.name AS eval_name,
            e.eval_date,
            er.score
        FROM
            eval_results er
            JOIN registers r ON er.register_code = r.code
            JOIN evals e ON er.eval_code = e.code
        WHERE
            r.student_code = p_student_code::UUID
            AND er.section_code IS NULL
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

-- Get student performance by course
CREATE OR REPLACE FUNCTION get_student_course_performance(p_student_code TEXT)
RETURNS TABLE (
    course_code TEXT,
    course_name VARCHAR,
    avg_score NUMERIC,
    total_evaluations INTEGER,
    best_score NUMERIC,
    worst_score NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.code::TEXT,
        c.name,
        ROUND(AVG(er.score), 2) AS avg_score,
        COUNT(er.code)::INTEGER AS total_evaluations,
        MAX(er.score) AS best_score,
        MIN(er.score) AS worst_score
    FROM
        courses c
        JOIN eval_sections es ON c.code = es.course_code
        JOIN eval_results er ON es.code = er.section_code
        JOIN registers r ON er.register_code = r.code
    WHERE
        r.student_code = p_student_code::UUID
    GROUP BY
        c.code, c.name
    ORDER BY
        avg_score DESC;
END;
$$;

-- =====================================================
-- EVALUATION DASHBOARD FUNCTIONS
-- =====================================================

-- Get comprehensive evaluation dashboard data
CREATE OR REPLACE FUNCTION get_eval_dashboard_data(p_eval_code TEXT)
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
            eval_questions eq
            JOIN eval_sections es ON eq.section_code = es.code
            JOIN courses c ON es.course_code = c.code
            LEFT JOIN eval_answers ea ON eq.code = ea.question_code
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
            eval_questions eq
            JOIN eval_sections es ON eq.section_code = es.code
            JOIN courses c ON es.course_code = c.code
            LEFT JOIN eval_answers ea ON eq.code = ea.question_code
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
            eval_results er
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
-- REPORTING FUNCTIONS
-- =====================================================

-- Get student evaluation report (for CSV export)
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
$$;
