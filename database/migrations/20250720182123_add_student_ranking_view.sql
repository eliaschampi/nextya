-- Migration: add_student_ranking_view
-- Created: 2025-07-20T18:21:23.138Z
-- Purpose: Create view and function for student ranking table

-- Create function to get student ranking with filters (both required)
CREATE OR REPLACE FUNCTION public.get_student_ranking(
    p_level_code UUID,
    p_group_name CHAR(1)
)
RETURNS TABLE (
    roll_code CHAR(4),
    name VARCHAR(100),
    last_name VARCHAR(150),
    average_score NUMERIC(5,2),
    total_evaluations INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Return empty if either parameter is NULL
    IF p_level_code IS NULL OR p_group_name IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        r.roll_code,
        s.name,
        s.last_name,
        ROUND(AVG(er.score)::numeric, 2) AS average_score,
        COUNT(er.code)::INTEGER AS total_evaluations
    FROM
        public.students s
        JOIN public.registers r ON s.code = r.student_code
        LEFT JOIN public.eval_results er ON r.code = er.register_code AND er.section_code IS NULL
    WHERE
        r.level_code = p_level_code
        AND r.group_name = p_group_name
    GROUP BY
        s.code, s.name, s.last_name, r.roll_code
    ORDER BY
        average_score DESC NULLS LAST, s.name ASC;
END;
$$;

-- Create view for default ranking (requires parameters, returns empty by default)
CREATE OR REPLACE VIEW public.student_ranking AS
SELECT
    roll_code,
    name,
    last_name,
    average_score,
    total_evaluations
FROM public.get_student_ranking(NULL, NULL);

-- Add indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_eval_results_register_section_ranking
ON public.eval_results (register_code, section_code, score)
WHERE section_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_registers_level_group_ranking
ON public.registers (level_code, group_name, student_code);

-- Add comments for documentation
COMMENT ON FUNCTION public.get_student_ranking IS
'Function to get student ranking with optional filters for level and group.
Returns students ordered by average score with ranking position determined by order.
Only includes students with at least one evaluation result.';

COMMENT ON VIEW public.student_ranking IS
'View showing top 10 students by average score across all levels and groups.
Use the get_student_ranking function for filtered results.';
