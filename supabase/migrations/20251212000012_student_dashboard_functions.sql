-- Create optimized functions for student dashboard data
-- These functions replace the use of student_register_results view with more efficient queries

-- Function to get student score evolution data
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
        -- Get all results for this student
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
            AND er.section_code IS NULL -- Only include general results
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

-- Function to get student course scores data
CREATE OR REPLACE FUNCTION get_student_course_scores(p_student_code TEXT)
RETURNS TABLE (
    course_code TEXT,
    course_name VARCHAR,
    average_score NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH course_results AS (
        -- Get section-specific results for the student
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
            r.student_code = p_student_code::UUID
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

-- Function to get student course evolution data (scores by course over time)
CREATE OR REPLACE FUNCTION get_student_course_evolution(p_student_code TEXT)
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
            eval_results er
            JOIN eval_sections es ON er.section_code = es.code
            JOIN courses c ON es.course_code = c.code
            JOIN evals e ON er.eval_code = e.code
            JOIN registers r ON er.register_code = r.code
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

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_student_score_evolution(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_course_scores(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_course_evolution(TEXT) TO authenticated;
