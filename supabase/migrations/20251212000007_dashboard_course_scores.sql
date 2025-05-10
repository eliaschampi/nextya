-- Create a function to get course-specific scores for a level with required group filter
CREATE OR REPLACE FUNCTION get_level_course_scores(p_level_code TEXT, p_group_name TEXT)
RETURNS TABLE (
    course_code UUID,
    course_name VARCHAR,
    average_score NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH course_results AS (
        -- Get section-specific results for the level
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
            AND er.section_code IS NOT NULL
            AND r.group_name = p_group_name
    )
    -- Calculate average score per course
    SELECT
        cr.course_code,
        cr.course_name,
        ROUND(AVG(cr.score)::NUMERIC, 2) AS average_score
    FROM
        course_results cr
    GROUP BY
        cr.course_code, cr.course_name
    ORDER BY
        average_score DESC;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_level_course_scores(TEXT, TEXT) TO authenticated;
