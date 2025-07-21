-- =====================================================
-- NextYa Database Views
-- =====================================================
-- All database views for easier data access
-- =====================================================

-- Student registers view
CREATE VIEW public.student_registers AS
SELECT
  s.code AS student_code,
  r.code AS register_code,
  s.name,
  s.last_name,
  s.email,
  s.phone,
  r.roll_code,
  r.group_name,
  r.level_code,
  l.name AS level,
  s.created_at
FROM
  public.registers r
  JOIN public.students s ON r.student_code = s.code
  JOIN public.levels l ON r.level_code = l.code;

-- Student register results view
CREATE OR REPLACE VIEW public.student_register_results AS
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
  er.section_code IS NULL;
