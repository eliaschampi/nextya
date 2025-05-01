-- Drop the function if it exists
DROP FUNCTION IF EXISTS get_student_eval_report(TEXT);

-- Create a function to get student evaluation results with course-specific scores
-- Using explicit type casting to ensure consistency
CREATE FUNCTION get_student_eval_report(p_student_code TEXT)
RETURNS TABLE (
    eval_name VARCHAR,
    eval_code TEXT,
    eval_date DATE,
    general_score NUMERIC,
    register_code TEXT,
    result_code TEXT,
    course_scores JSON
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_register_codes UUID[];
BEGIN
    -- Get all register codes for this student
    SELECT array_agg(code) INTO v_register_codes
    FROM registers
    WHERE student_code = p_student_code::UUID;

    -- Return empty set if no registers found
    IF v_register_codes IS NULL OR array_length(v_register_codes, 1) = 0 THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH general_results AS (
        -- Get general results (without section_code)
        SELECT
            e.name AS eval_name,
            e.code::TEXT AS eval_code,
            e.eval_date,
            er.score AS general_score,
            er.register_code::TEXT AS register_code,
            er.code::TEXT AS result_code
        FROM
            eval_results er
            JOIN evals e ON er.eval_code = e.code
        WHERE
            er.register_code = ANY(v_register_codes)
            AND er.section_code IS NULL
        ORDER BY
            e.eval_date DESC
    ),
    section_results AS (
        -- Get section-specific results
        SELECT
            er.register_code::TEXT AS register_code,
            er.eval_code::TEXT AS eval_code,
            er.section_code,
            er.score,
            c.name AS course_name
        FROM
            eval_results er
            JOIN eval_sections es ON er.section_code = es.code
            JOIN courses c ON es.course_code = c.code
        WHERE
            er.register_code = ANY(v_register_codes)
            AND er.section_code IS NOT NULL
    ),
    course_scores_json AS (
        -- Aggregate section results into JSON by eval
        SELECT
            sr.register_code,
            sr.eval_code,
            json_object_agg(
                sr.course_name,
                sr.score
            ) AS course_scores
        FROM
            section_results sr
        GROUP BY
            sr.register_code, sr.eval_code
    )
    -- Join everything together
    SELECT
        gr.eval_name,
        gr.eval_code,
        gr.eval_date,
        gr.general_score,
        gr.register_code,
        gr.result_code,
        COALESCE(csj.course_scores, '{}'::JSON) AS course_scores
    FROM
        general_results gr
        LEFT JOIN course_scores_json csj ON gr.register_code = csj.register_code AND gr.eval_code = csj.eval_code
    ORDER BY
        gr.eval_date DESC;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_student_eval_report(TEXT) TO authenticated;