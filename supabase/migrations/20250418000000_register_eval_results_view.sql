-- Create a function to get evaluation results with student information
CREATE OR REPLACE FUNCTION get_register_eval_results(p_eval_code TEXT)
RETURNS TABLE (
    result_code TEXT,
    register_code TEXT,
    eval_code TEXT,
    section_code TEXT,
    correct_count INTEGER,
    incorrect_count INTEGER,
    blank_count INTEGER,
    score NUMERIC,
    calculated_at TIMESTAMP WITH TIME ZONE,
    student_code TEXT,
    roll_code TEXT,
    group_name TEXT,
    level_code TEXT,
    name TEXT,
    last_name TEXT,
    level_name TEXT
) LANGUAGE SQL SECURITY DEFINER AS $$
    SELECT
        er.code AS result_code,
        er.register_code,
        er.eval_code,
        er.section_code,
        er.correct_count,
        er.incorrect_count,
        er.blank_count,
        er.score,
        er.calculated_at,
        r.student_code,
        r.roll_code,
        r.group_name,
        r.level_code,
        s.name,
        s.last_name,
        l.name AS level_name
    FROM
        eval_results er
        INNER JOIN registers r ON er.register_code = r.code
        INNER JOIN students s ON r.student_code = s.code
        INNER JOIN levels l ON r.level_code = l.code
    WHERE
        er.eval_code = p_eval_code::UUID
        AND er.section_code IS NULL -- Only include general results (not section-specific)
    ORDER BY
        er.score DESC;
$$;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_register_eval_results(TEXT) TO authenticated;