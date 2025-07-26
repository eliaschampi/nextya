-- =====================================================
-- NextYa Database Dashboard Functions
-- =====================================================
-- Dashboard and reporting functions
-- =====================================================

-- Student evaluation report function
CREATE OR REPLACE FUNCTION public.get_student_eval_report (p_student_code TEXT) 
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
    FROM public.registers
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
            public.eval_results er
            JOIN public.evals e ON er.eval_code = e.code
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
            public.eval_results er
            JOIN public.eval_sections es ON er.section_code = es.code
            JOIN public.courses c ON es.course_code = c.code
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

-- Course dashboard functions
CREATE OR REPLACE FUNCTION public.get_level_course_scores (p_level_code TEXT, p_group_name TEXT)
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
            public.eval_results er
            JOIN public.eval_sections es ON er.section_code = es.code
            JOIN public.courses c ON es.course_code = c.code
            JOIN public.registers r ON er.register_code = r.code
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

-- Course evaluation scores function
CREATE OR REPLACE FUNCTION public.get_course_eval_scores (
  p_level_code TEXT,
  p_course_code TEXT,
  p_group_name TEXT
) RETURNS TABLE (
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
            public.eval_results er
            JOIN public.eval_sections es ON er.section_code = es.code
            JOIN public.evals e ON er.eval_code = e.code
            JOIN public.registers r ON er.register_code = r.code
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

-- Student dashboard functions
CREATE OR REPLACE FUNCTION public.get_student_score_evolution (p_student_code TEXT) 
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
            public.eval_results er
            JOIN public.registers r ON er.register_code = r.code
            JOIN public.evals e ON er.eval_code = e.code
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

-- Student course scores function
CREATE OR REPLACE FUNCTION public.get_student_course_scores (p_student_code TEXT) 
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
            public.eval_results er
            JOIN public.eval_sections es ON er.section_code = es.code
            JOIN public.courses c ON es.course_code = c.code
            JOIN public.registers r ON er.register_code = r.code
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

-- Score distribution by course function
CREATE OR REPLACE FUNCTION public.get_course_score_distribution (
  p_level_code TEXT,
  p_group_name TEXT,
  p_course_code TEXT
) RETURNS TABLE (
  approved NUMERIC,
  middle NUMERIC,
  failed NUMERIC,
  approved_count INTEGER,
  middle_count INTEGER,
  failed_count INTEGER,
  total_count INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    WITH score_ranges AS (
        SELECT
            COUNT(CASE WHEN er.score >= 14 THEN 1 END) AS approved_count,
            COUNT(CASE WHEN er.score >= 10 AND er.score < 14 THEN 1 END) AS middle_count,
            COUNT(CASE WHEN er.score < 10 THEN 1 END) AS failed_count,
            COUNT(*) AS total_count
        FROM
            public.eval_results er
            JOIN public.eval_sections es ON er.section_code = es.code
            JOIN public.registers r ON er.register_code = r.code
        WHERE
            r.level_code = p_level_code::UUID
            AND r.group_name = p_group_name
            AND es.course_code = p_course_code::UUID
            AND er.section_code IS NOT NULL
    )
    SELECT
        CASE
            WHEN sr.total_count > 0 THEN
                ROUND((sr.approved_count::NUMERIC / sr.total_count) * 100, 2)
            ELSE 0
        END AS approved,
        CASE
            WHEN sr.total_count > 0 THEN
                ROUND((sr.middle_count::NUMERIC / sr.total_count) * 100, 2)
            ELSE 0
        END AS middle,
        CASE
            WHEN sr.total_count > 0 THEN
                ROUND((sr.failed_count::NUMERIC / sr.total_count) * 100, 2)
            ELSE 0
        END AS failed,
        sr.approved_count::INTEGER,
        sr.middle_count::INTEGER,
        sr.failed_count::INTEGER,
        sr.total_count::INTEGER
    FROM
        score_ranges sr;
END;
$$;
