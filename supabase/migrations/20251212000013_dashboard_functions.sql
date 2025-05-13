-- Create optimized functions for dashboard data
-- These functions replace the use of student_register_results view with more efficient queries

-- Function to get level dashboard data (correctVsIncorrect and scoresByGroup)
CREATE OR REPLACE FUNCTION get_level_dashboard_data(p_level_code TEXT)
RETURNS TABLE (
    data_type TEXT,
    json_data JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
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
        eval_results er
        JOIN registers r ON er.register_code = r.code
    WHERE
        r.level_code = p_level_code::UUID
        AND er.section_code IS NULL;

    -- Get scores by group data
    WITH group_scores AS (
        SELECT
            r.group_name,
            ROUND(AVG(er.score)::numeric, 2) AS average_score
        FROM
            eval_results er
            JOIN registers r ON er.register_code = r.code
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

-- Function to get group dashboard data (scoresByEval and studentPerformance)
CREATE OR REPLACE FUNCTION get_group_dashboard_data(p_level_code TEXT, p_group_name TEXT)
RETURNS TABLE (
    data_type TEXT,
    json_data JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_scores_by_eval JSONB;
    v_student_performance JSONB;
BEGIN
    -- Get scores by eval data
    WITH eval_scores AS (
        SELECT
            e.name,
            e.eval_date,
            ROUND(AVG(er.score)::numeric, 2) AS average_score
        FROM
            eval_results er
            JOIN registers r ON er.register_code = r.code
            JOIN evals e ON er.eval_code = e.code
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

    -- Get student performance data (top 10)
    WITH student_scores AS (
        SELECT
            s.name || ' ' || s.last_name AS student_name,
            ROUND(AVG(er.score)::numeric, 2) AS avg_score
        FROM
            eval_results er
            JOIN registers r ON er.register_code = r.code
            JOIN students s ON r.student_code = s.code
        WHERE
            r.level_code = p_level_code::UUID
            AND r.group_name = p_group_name
            AND er.section_code IS NULL
        GROUP BY
            s.code, s.name, s.last_name
        ORDER BY
            avg_score DESC
        LIMIT 10
    )
    SELECT
        jsonb_agg(
            jsonb_build_object(
                'name', ss.student_name,
                'averageScore', ss.avg_score
            )
            ORDER BY ss.avg_score DESC
        ) INTO v_student_performance
    FROM
        student_scores ss;

    -- Return the data
    RETURN QUERY
    SELECT 'scoresByEval', COALESCE(v_scores_by_eval, '[]'::jsonb)
    UNION ALL
    SELECT 'studentPerformance', COALESCE(v_student_performance, '[]'::jsonb);
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_level_dashboard_data(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_group_dashboard_data(TEXT, TEXT) TO authenticated;
