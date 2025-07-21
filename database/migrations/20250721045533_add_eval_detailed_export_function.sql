-- Migration: add_eval_detailed_export_function
-- Created: 2025-07-21T04:55:33.406Z
-- Purpose: Add function to get detailed evaluation results with course scores for export

-- Evaluation detailed results function for export
CREATE OR REPLACE FUNCTION public.get_eval_detailed_results (p_eval_code TEXT)
RETURNS TABLE (
  roll_code CHAR(4),
  name VARCHAR,
  last_name VARCHAR,
  group_name CHAR(1),
  general_score NUMERIC,
  course_scores JSON
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_register_codes UUID[];
BEGIN
    -- Get all register codes for this evaluation
    SELECT array_agg(DISTINCT r.code) INTO v_register_codes
    FROM public.registers r
    JOIN public.eval_results er ON r.code = er.register_code
    WHERE er.eval_code = p_eval_code::UUID;

    -- Return empty set if no registers found
    IF v_register_codes IS NULL OR array_length(v_register_codes, 1) = 0 THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH general_results AS (
        -- Get general results (without section_code)
        SELECT
            r.roll_code,
            s.name,
            s.last_name,
            r.group_name,
            er.score AS general_score,
            er.register_code
        FROM
            public.eval_results er
            JOIN public.registers r ON er.register_code = r.code
            JOIN public.students s ON r.student_code = s.code
        WHERE
            er.eval_code = p_eval_code::UUID
            AND er.section_code IS NULL
    ),
    section_results AS (
        -- Get section-specific results
        SELECT
            er.register_code,
            er.score,
            c.name AS course_name
        FROM
            public.eval_results er
            JOIN public.eval_sections es ON er.section_code = es.code
            JOIN public.courses c ON es.course_code = c.code
        WHERE
            er.eval_code = p_eval_code::UUID
            AND er.section_code IS NOT NULL
    ),
    course_scores_json AS (
        -- Aggregate section results into JSON by register
        SELECT
            sr.register_code,
            json_object_agg(
                sr.course_name,
                sr.score
            ) AS course_scores
        FROM
            section_results sr
        GROUP BY
            sr.register_code
    )
    SELECT
        gr.roll_code,
        gr.name,
        gr.last_name,
        gr.group_name,
        gr.general_score,
        COALESCE(csj.course_scores, '{}'::json) AS course_scores
    FROM
        general_results gr
        LEFT JOIN course_scores_json csj ON gr.register_code = csj.register_code
    ORDER BY
        gr.general_score DESC, gr.name ASC;
END;
$$;
