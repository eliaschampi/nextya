-- supabase/migrations/20250420000000_student_register_results_view.sql

-- Create a view to get student evaluation results across registers
CREATE OR REPLACE VIEW public.student_register_results WITH (security_invoker = true) AS
SELECT
    er.code AS result_code,
    er.register_code,
    er.eval_code,
    er.correct_count,
    er.incorrect_count,
    er.blank_count,
    er.score,
    er.calculated_at,
    r.student_code,
    r.roll_code,
    r.group_name AS register_group_name,
    r.level_code,
    s.name AS student_name,
    s.last_name AS student_last_name,
    l.name AS level_name,
    e.name AS eval_name,
    e.eval_date
FROM
    public.eval_results er
    JOIN public.registers r ON er.register_code = r.code
    JOIN public.students s ON r.student_code = s.code
    JOIN public.levels l ON r.level_code = l.code
    JOIN public.evals e ON er.eval_code = e.code
WHERE
    er.section_code IS NULL; -- Only include general results (not section-specific)

-- Grant select permissions to authenticated users
GRANT SELECT ON public.student_register_results TO authenticated;