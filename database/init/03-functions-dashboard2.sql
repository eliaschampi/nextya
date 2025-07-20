-- =====================================================
-- NextYa Database Dashboard Functions (Part 2)
-- =====================================================
-- Additional dashboard and reporting functions
-- =====================================================

-- Student course evolution function
CREATE OR REPLACE FUNCTION public.get_student_course_evolution (p_student_code TEXT) 
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
CREATE OR REPLACE FUNCTION public.get_level_dashboard_data (p_level_code TEXT) 
RETURNS TABLE (data_type TEXT, json_data JSONB) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
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
CREATE OR REPLACE FUNCTION public.get_group_dashboard_data (p_level_code TEXT, p_group_name TEXT) 
RETURNS TABLE (data_type TEXT, json_data JSONB) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_scores_by_eval JSONB;
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

    -- Return the data
    RETURN QUERY
    SELECT 'scoresByEval', COALESCE(v_scores_by_eval, '[]'::jsonb);
END;
$$;

-- Evaluation dashboard data function
CREATE OR REPLACE FUNCTION public.get_eval_dashboard_data (p_eval_code TEXT) 
RETURNS TABLE (data_type TEXT, json_data JSONB) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
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
