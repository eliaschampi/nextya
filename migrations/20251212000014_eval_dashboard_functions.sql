-- Create a function to get evaluation dashboard data
-- This function returns:
-- 1. Top 5 most correctly answered questions
-- 2. Top 5 most incorrectly answered questions
-- 3. Percentage of students with scores in different ranges (approved, between 10-14, below 10)

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

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_eval_dashboard_data(TEXT) TO authenticated;
