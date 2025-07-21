-- =====================================================
-- NextYa Database Grants - SIMPLE PUBLIC SCHEMA
-- =====================================================
-- Simple grants using only public schema and database owner
-- All security handled at the application level
-- =====================================================

-- =====================================================
-- GRANTS AND PERMISSIONS
-- =====================================================
-- Note: These grants will be applied to the database owner
-- The database owner is set when creating the database with -O flag
-- Example: createdb nextya -O your_db_user

-- Grant usage on schema to database owner (automatically has it, but explicit is better)
-- GRANT USAGE ON SCHEMA public TO current_user;

-- Grant permissions on all tables (database owner already has these, but for completeness)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO current_user;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO current_user;
-- GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO current_user;

-- Grant default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO current_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO current_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO current_user;

-- Note: Since you're creating the database with -O your_db_user,
-- that user will be the owner and automatically have EXECUTE permissions on all functions
-- and SELECT permissions on all views. These explicit grants are redundant but kept for clarity.

-- If you need to grant to a different user, replace 'current_user' with the specific username
-- For example: GRANT EXECUTE ON FUNCTION public.upsert_eval_results(...) TO your_db_user;

-- Grant execute on specific functions (commented out as owner already has these permissions)
-- GRANT EXECUTE ON FUNCTION public.upsert_eval_results (uuid, uuid, JSONB, JSONB, JSONB) TO current_user;
-- GRANT EXECUTE ON FUNCTION public.timestamp_updater () TO current_user;
-- GRANT EXECUTE ON FUNCTION public.import_student_register (TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, UUID) TO current_user;
-- GRANT EXECUTE ON FUNCTION public.get_student_eval_report (TEXT) TO current_user;
-- GRANT EXECUTE ON FUNCTION public.get_level_course_scores (TEXT, TEXT) TO current_user;
-- GRANT EXECUTE ON FUNCTION public.get_course_eval_scores (TEXT, TEXT, TEXT) TO current_user;
-- GRANT EXECUTE ON FUNCTION public.get_student_score_evolution (TEXT) TO current_user;
-- GRANT EXECUTE ON FUNCTION public.get_student_course_scores (TEXT) TO current_user;
-- GRANT EXECUTE ON FUNCTION public.get_student_course_evolution (TEXT) TO current_user;
-- GRANT EXECUTE ON FUNCTION public.get_level_dashboard_data (TEXT) TO current_user;
-- GRANT EXECUTE ON FUNCTION public.get_group_dashboard_data (TEXT, TEXT) TO current_user;
-- GRANT EXECUTE ON FUNCTION public.get_eval_dashboard_data (TEXT) TO current_user;

-- Grant select permissions on views (commented out as owner already has these permissions)
-- GRANT SELECT ON public.student_registers TO current_user;
-- GRANT SELECT ON public.student_register_results TO current_user;
