-- Migration: add evals with sections view
-- Created: 2025-07-16T03:42:34.406Z
-- Optimized PostgreSQL view for evals with sections aggregation

-- Create optimized view for evals with pre-aggregated sections
CREATE VIEW public.evals_with_sections AS
SELECT
    e.code,
    e.name,
    e.level_code,
    e.group_name,
    e.eval_date,
    e.user_code,
    e.created_at,
    e.updated_at,
    l.name as level_name,
    COALESCE(
        JSON_AGG(
            CASE
                WHEN es.code IS NOT NULL THEN
                    JSON_BUILD_OBJECT(
                        'code', es.code,
                        'eval_code', es.eval_code,
                        'course_code', es.course_code,
                        'order_in_eval', es.order_in_eval,
                        'question_count', es.question_count,
                        'course_name', COALESCE(c.name, 'Sin nombre')
                    )
                ELSE NULL
            END
            ORDER BY es.order_in_eval
        ) FILTER (WHERE es.code IS NOT NULL),
        '[]'::json
    ) as eval_sections
FROM public.evals e
INNER JOIN public.levels l ON l.code = e.level_code
LEFT JOIN public.eval_sections es ON es.eval_code = e.code
LEFT JOIN public.courses c ON c.code = es.course_code
GROUP BY
    e.code,
    e.name,
    e.level_code,
    e.group_name,
    e.eval_date,
    e.user_code,
    e.created_at,
    e.updated_at,
    l.name;

-- Create index on level_code for optimal filtering performance
CREATE INDEX IF NOT EXISTS idx_evals_with_sections_level_code
ON public.evals (level_code, eval_date);

-- Add comment for documentation
COMMENT ON VIEW public.evals_with_sections IS
'Optimized view that pre-aggregates eval sections using JSON functions for maximum performance.
Eliminates the need for JavaScript grouping in the API layer.';
