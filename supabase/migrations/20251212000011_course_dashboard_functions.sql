-- Create optimized functions for course dashboard data
-- These functions replace the use of student_register_results view with more efficient queries

-- Function to get course scores for a specific level and group
CREATE OR REPLACE FUNCTION get_level_course_scores(p_level_code TEXT, p_group_name TEXT)
RETURNS TABLE (
    course_code TEXT,
    course_name VARCHAR,
    average_score NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH course_results AS (
        -- Get section-specific results for the level and group
        SELECT
            es.course_code,
            c.name AS course_name,
            er.score
        FROM
            eval_results er
            JOIN eval_sections es ON er.section_code = es.code
            JOIN courses c ON es.course_code = c.code
            JOIN registers r ON er.register_code = r.code
        WHERE
            r.level_code = p_level_code::UUID
            AND r.group_name = p_group_name
            AND er.section_code IS NOT NULL
    ),
    course_averages AS (
        -- Calculate average score per course
        SELECT
            cr.course_code,
            cr.course_name,
            AVG(cr.score) AS average_score
        FROM
            course_results cr
        GROUP BY
            cr.course_code, cr.course_name
    )
    SELECT
        ca.course_code::TEXT,
        ca.course_name,
        ROUND(ca.average_score, 2) AS average_score
    FROM
        course_averages ca
    ORDER BY
        ca.course_name;
END;
$$;

-- Function to get evaluation scores for a specific level, course and group
CREATE OR REPLACE FUNCTION get_course_eval_scores(
    p_level_code TEXT,
    p_course_code TEXT,
    p_group_name TEXT
)
RETURNS TABLE (
    eval_code TEXT,
    eval_name VARCHAR,
    eval_date DATE,
    average_score NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH eval_results_data AS (
        -- Get section-specific results for the level, course and group
        SELECT
            e.code AS eval_code,
            e.name AS eval_name,
            e.eval_date,
            er.score
        FROM
            eval_results er
            JOIN eval_sections es ON er.section_code = es.code
            JOIN evals e ON er.eval_code = e.code
            JOIN registers r ON er.register_code = r.code
        WHERE
            r.level_code = p_level_code::UUID
            AND r.group_name = p_group_name
            AND es.course_code = p_course_code::UUID
            AND er.section_code IS NOT NULL
    ),
    eval_averages AS (
        -- Calculate average score per evaluation
        SELECT
            erd.eval_code,
            erd.eval_name,
            erd.eval_date,
            AVG(erd.score) AS average_score
        FROM
            eval_results_data erd
        GROUP BY
            erd.eval_code, erd.eval_name, erd.eval_date
    )
    SELECT
        ea.eval_code::TEXT,
        ea.eval_name,
        ea.eval_date,
        ROUND(ea.average_score, 2) AS average_score
    FROM
        eval_averages ea
    ORDER BY
        ea.eval_date ASC;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_level_course_scores(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_course_eval_scores(TEXT, TEXT, TEXT) TO authenticated;
