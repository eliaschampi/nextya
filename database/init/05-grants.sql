-- =====================================================
-- NextYa Database Grants - NO POLICIES VERSION
-- =====================================================
-- Simple grants without any RLS or permission checking
-- All security handled at the application level
-- =====================================================

-- =====================================================
-- GRANTS AND PERMISSIONS
-- =====================================================
-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO postgres;

-- Grant permissions on all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Grant execute on specific functions
GRANT EXECUTE ON FUNCTION public.get_register_eval_results (TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.upsert_eval_results (uuid, uuid, JSONB, JSONB, JSONB) TO postgres;
GRANT EXECUTE ON FUNCTION public.timestamp_updater () TO postgres;
GRANT EXECUTE ON FUNCTION public.import_student_register (TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, UUID) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_student_eval_report (TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_level_course_scores (TEXT, TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_course_eval_scores (TEXT, TEXT, TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_student_score_evolution (TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_student_course_scores (TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_student_course_evolution (TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_level_dashboard_data (TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_group_dashboard_data (TEXT, TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION public.get_eval_dashboard_data (TEXT) TO postgres;

-- Grant select permissions on views
GRANT SELECT ON public.student_registers TO postgres;
GRANT SELECT ON public.student_register_results TO postgres;
